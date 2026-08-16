// Fake Firebase module served in place of the three gstatic modules.
// Implements enough of Firestore's query semantics (where / orderBy / limit)
// that the app's real code paths run unmodified, and records every write.

const store = (window.__seed = window.__seed || {});
window.__writes = window.__writes || [];
window.__queries = window.__queries || [];

let idCounter = 0;
function nextId(prefix) { return `${prefix}-gen-${++idCounter}`; }

function log(op, payload) {
  window.__writes.push({ op, ...payload, at: window.__writes.length });
}

export function initializeApp() { return { name: '[DEFAULT]' }; }
export function getFirestore() { return { __db: true }; }
export function enableIndexedDbPersistence() { return Promise.resolve(); }

export function collection(_db, name) { return { __type: 'collection', name }; }

export function doc(a, b, c) {
  // doc(db, "coll", "id")  |  doc(collectionRef, "id")
  if (a && a.__type === 'collection') return { __type: 'doc', name: a.name, id: b };
  if (typeof b === 'string' && typeof c === 'string') return { __type: 'doc', name: b, id: c };
  return { __type: 'doc', name: b, id: c === undefined ? nextId(b) : c };
}

export function where(field, op, value) { return { __c: 'where', field, op, value }; }
export function orderBy(field, dir = 'asc') { return { __c: 'orderBy', field, dir }; }
export function limit(n) { return { __c: 'limit', n }; }

export function query(ref, ...constraints) {
  const base = ref.__type === 'query' ? ref : { __type: 'query', name: ref.name, constraints: [] };
  return { __type: 'query', name: base.name, constraints: [...base.constraints, ...constraints] };
}

function cmp(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : 1;
}

function passes(row, c) {
  const v = row[c.field];
  switch (c.op) {
    case '==': return v === c.value;
    case '!=': return v !== c.value;
    case '>=': return cmp(v, c.value) >= 0;
    case '>': return cmp(v, c.value) > 0;
    case '<=': return cmp(v, c.value) <= 0;
    case '<': return cmp(v, c.value) < 0;
    case 'in': return Array.isArray(c.value) && c.value.includes(v);
    default: return true;
  }
}

// Real Firestore rejects a query that filters on an inequality over one field
// and sorts by a different field unless a composite index exists. Emulate that
// so the app's index-dependent queries surface here instead of silently working.
function requiresCompositeIndex(name, constraints) {
  const ineq = constraints.filter(c => c.__c === 'where' && ['<', '<=', '>', '>='].includes(c.op));
  const eq = constraints.filter(c => c.__c === 'where' && c.op === '==');
  const ord = constraints.filter(c => c.__c === 'orderBy');
  if (!ord.length) return false;
  if (ineq.length && ineq[0].field !== ord[0].field) return true;
  if (eq.length && ord.length && eq.some(e => e.field !== ord[0].field)) return true;
  return false;
}

export function getDocs(q) {
  const name = q.name;
  const constraints = q.constraints || [];
  window.__queries.push({ name, constraints: JSON.parse(JSON.stringify(constraints)) });

  if (window.__indexEnforcement && requiresCompositeIndex(name, constraints)) {
    const err = new Error(
      `The query requires an index. You can create it here: https://console.firebase.google.com/...`
    );
    err.code = 'failed-precondition';
    return Promise.reject(err);
  }

  let rows = (store[name] || []).map(r => ({ ...r }));
  constraints.filter(c => c.__c === 'where').forEach(c => { rows = rows.filter(r => passes(r, c)); });
  const ord = constraints.filter(c => c.__c === 'orderBy');
  if (ord.length) {
    rows.sort((x, y) => {
      for (const o of ord) {
        const d = cmp(x[o.field], y[o.field]) * (o.dir === 'desc' ? -1 : 1);
        if (d !== 0) return d;
      }
      return 0;
    });
  }
  const lim = constraints.find(c => c.__c === 'limit');
  if (lim) rows = rows.slice(0, lim.n);

  const docs = rows.map(r => {
    const { id, ...data } = r;
    return { id, exists: () => true, data: () => ({ ...data }) };
  });
  return Promise.resolve({
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (fn) => docs.forEach(fn)
  });
}

export function addDoc(ref, data) {
  const name = ref.name;
  const id = nextId(name);
  store[name] = store[name] || [];
  store[name].push({ id, ...JSON.parse(JSON.stringify(data)) });
  log('addDoc', { collection: name, id, data: JSON.parse(JSON.stringify(data)) });
  if (window.__writeDelayMs) {
    return new Promise(res => setTimeout(() => res({ id }), window.__writeDelayMs));
  }
  return Promise.resolve({ id });
}

export function updateDoc(ref, data) {
  const name = ref.name, id = ref.id;
  const arr = store[name] || [];
  const row = arr.find(r => r.id === id);
  if (row) Object.assign(row, JSON.parse(JSON.stringify(data)));
  log('updateDoc', { collection: name, id, data: JSON.parse(JSON.stringify(data)), found: !!row });
  if (window.__writeDelayMs) {
    return new Promise(res => setTimeout(res, window.__writeDelayMs));
  }
  return Promise.resolve();
}

export function deleteDoc(ref) {
  const name = ref.name, id = ref.id;
  store[name] = (store[name] || []).filter(r => r.id !== id);
  log('deleteDoc', { collection: name, id });
  return Promise.resolve();
}

export function writeBatch() {
  const ops = [];
  return {
    set: (ref, data) => ops.push(['set', ref, data]),
    update: (ref, data) => ops.push(['update', ref, data]),
    delete: (ref) => ops.push(['delete', ref]),
    commit: () => {
      ops.forEach(([op, ref, data]) => {
        if (op === 'delete') deleteDoc(ref);
        else if (op === 'update') updateDoc(ref, data);
        else {
          store[ref.name] = store[ref.name] || [];
          const id = ref.id || nextId(ref.name);
          store[ref.name].push({ id, ...data });
          log('batchSet', { collection: ref.name, id, data });
        }
      });
      log('batchCommit', { count: ops.length });
      return Promise.resolve();
    }
  };
}

// ---- auth ----
const fakeUser = { uid: 'stub-uid-0001', isAnonymous: true };
export function getAuth() { return { currentUser: null }; }
export function signInAnonymously(auth) {
  auth.currentUser = fakeUser;
  return Promise.resolve({ user: fakeUser });
}
export function onAuthStateChanged(auth, cb) {
  // Mirror the real SDK: fire async with the restored user.
  setTimeout(() => { auth.currentUser = fakeUser; cb(fakeUser); }, 0);
  return () => {};
}
