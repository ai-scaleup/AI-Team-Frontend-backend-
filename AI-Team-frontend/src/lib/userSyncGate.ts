// Single promise that resolves once the user has been synced to the backend.
// UserSync resolves it; services await it before API calls.

let resolveSync: () => void = () => {}
let done = false

export const userSyncGate: Promise<void> = new Promise<void>((resolve) => {
  resolveSync = resolve
})

export function markUserSynced() {
  done = true
  resolveSync()
}

export function isUserSynced() {
  return done
}

export async function waitForUserSync(timeoutMs = 5000): Promise<void> {
  if (done) return

  await Promise.race([
    userSyncGate,
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}
