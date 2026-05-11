type LoadingSnapshot = {
  active: boolean;
  delayMs: number;
  label: string;
};

type Listener = (snapshot: LoadingSnapshot) => void;

let snapshot: LoadingSnapshot = {
  active: false,
  delayMs: 0,
  label: "Loading"
};

const listeners = new Set<Listener>();

export function showGlobalLoading(
  label = "Loading",
  options: { delayMs?: number } = {}
) {
  snapshot = { active: true, delayMs: options.delayMs ?? 0, label };
  emit();
}

export function hideGlobalLoading() {
  snapshot = { ...snapshot, active: false };
  emit();
}

export function getGlobalLoadingSnapshot() {
  return snapshot;
}

export function subscribeGlobalLoading(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => listener(snapshot));
}
