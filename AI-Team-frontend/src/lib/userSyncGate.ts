// Single promise that resolves once the user has been synced to the backend.
// UserSync component resolves it; services await it before API calls.

let _resolve: () => void = () => {}
let _done = false

export const userSyncGate: Promise<void> = new Promise<void>((resolve) => {
    _resolve = resolve
})

export function markUserSynced() {
    _done = true
    _resolve()
}

export function isUserSynced() {
    return _done
}

// Waits for sync with a timeout so pages don't hang forever if sync fails.
export async function waitForUserSync(timeoutMs = 5000): Promise<void> {
    if (_done) return
    await Promise.race([
        userSyncGate,
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ])
}
