// Browser-safe trainer candidate index loader.

let _cache = null;
let _loadPromise = null;

export async function loadTrainerCandidateIndexBrowser(baseUrl = '') {
  if (_cache) return _cache;
  if (_loadPromise) return _loadPromise;
  const url = `${baseUrl}data/trainer/built/trainer-candidate-index.json`;
  _loadPromise = fetch(url)
    .then((res) => (res.ok ? res.json() : { candidates: [], candidateCount: 0 }))
    .then((data) => {
      _cache = data;
      return data;
    })
    .catch(() => {
      _cache = { candidates: [], candidateCount: 0 };
      return _cache;
    });
  return _loadPromise;
}

export function getTrainerCandidateIndexCache() {
  return _cache;
}

export function setTrainerCandidateIndexCache(data) {
  _cache = data;
}
