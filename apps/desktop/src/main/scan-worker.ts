import { allRules, scan } from '@mp/core'
import { NodeFsPort } from '@mp/port-node'
import type { FromWorker, ToWorker } from './scan-protocol'

/**
 * The scan runs here, in a utility process, and not in main.
 *
 * Walking a real ~/Library/Caches means hundreds of thousands of stat calls.
 * On main's event loop that is the window going unresponsive while it happens -
 * main also serves window events, IPC and the tray. Out here it is someone
 * else's event loop, and cancelling is `child.kill()` rather than a flag the
 * loop has to remember to check.
 */
const parent = (process as unknown as { parentPort: Electron.ParentPort }).parentPort

function send(message: FromWorker) {
  parent.postMessage(message)
}

parent.on('message', (event) => {
  const message = event.data as ToWorker
  if (message.type !== 'scan') return

  void scan(new NodeFsPort(message.home), allRules(), {
    onProgress: ({ done, total, ruleId }) => send({ type: 'progress', done, total, ruleId }),
  })
    .then((report) => send({ type: 'done', report }))
    .catch((error: unknown) =>
      send({ type: 'failed', message: error instanceof Error ? error.message : String(error) }),
    )
})
