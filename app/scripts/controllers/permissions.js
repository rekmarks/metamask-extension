const JsonRpcEngine = require('json-rpc-engine')
const asMiddleware = require('json-rpc-engine/src/asMiddleware')
const createAsyncMiddleware = require('json-rpc-engine/src/createAsyncMiddleware')
const ObservableStore = require('obs-store')
const RpcCap = require('json-rpc-capabilities-middleware').CapabilitiesController
const { errors: rpcErrors } = require('eth-json-rpc-errors')

// Methods that do not require any permissions to use:
const SAFE_METHODS = require('../lib/permissions-safe-methods.json')

const METHOD_PREFIX = 'wallet_'
const INTERNAL_METHOD_PREFIX = 'metamask_'

function prefix (method) {
  return METHOD_PREFIX + method
}

// class PermissionsController extends SafeEventEmitter {
class PermissionsController {

  constructor ({
    openPopup, closePopup, keyringController, newPreApprovedTransaction
  } = {}, restoredState) {
    this.memStore = new ObservableStore({ siteMetadata: {} })
    this._openPopup = openPopup
    this._closePopup = closePopup
    this.keyringController = keyringController
    this.newPreApprovedTransaction = newPreApprovedTransaction
    this._initializePermissions(restoredState)
  }

  createMiddleware (options) {
    const { origin } = options
    const engine = new JsonRpcEngine()
    engine.push(this.createRequestMiddleware(options))
    engine.push(this.permissions.providerMiddlewareFunction.bind(
      this.permissions, { origin }
    ))
    return asMiddleware(engine)
  }

  /**
   * Create middleware for preprocessing permissions requests.
   */
  createRequestMiddleware () {
    return createAsyncMiddleware(async (req, res, next) => {

      if (typeof req.method !== 'string') {
        res.error = rpcErrors.invalidRequest(null, req)
        return // TODO:json-rpc-engine
      }

      if (req.method.startsWith(INTERNAL_METHOD_PREFIX)) {
        switch (req.method.split(INTERNAL_METHOD_PREFIX)[1]) {
          case 'sendSiteMetadata':
            if (
              req.siteMetadata &&
              typeof req.siteMetadata.name === 'string'
            ) {
              this.memStore.putState({
                siteMetadata: {
                  ...this.memStore.getState().siteMetadata,
                  [req.origin]: req.siteMetadata,
                },
              })
            }
            break
          default:
            res.error = rpcErrors.methodNotFound(null, req.method)
            break
        }
        if (!res.error) res.result = true
        return
      }

      return next()
    })
  }

  /**
   * Returns the accounts that should be exposed for the given origin domain,
   * if any. This method exists for when a trusted context needs to know
   * which accounts are exposed to a given domain.
   *
   * Do not use in untrusted contexts; just send an RPC request.
   *
   * @param {string} origin
   */
  getAccounts (origin) {
    return new Promise((resolve, _) => {
      const req = { method: 'eth_accounts' }
      const res = {}
      this.permissions.providerMiddlewareFunction(
        { origin }, req, res, () => {}, _end
      )

      function _end () {
        if (res.error || !Array.isArray(res.result)) resolve([])
        else resolve(res.result)
      }
    })
  }

  /**
   * Removes the given permissions for the given domain.
   * @param {object} domains { origin: [permissions] }
   */
  removePermissionsFor (domains) {
    Object.entries(domains).forEach(([origin, perms]) => {
      this.permissions.removePermissionsFor(
        origin,
        perms.map(methodName => {
          return { parentCapability: methodName }
        })
      )
    })
  }

  /**
   * Removes all known domains and their related permissions.
   */
  clearPermissions () {
    this.permissions.clearDomains()
  }

  /**
   * User approval callback.
   * @param {object} approved the approved request object
   */
  async approvePermissionsRequest (approved) {
    const { id } = approved.metadata
    const approval = this.pendingApprovals[id]
    const resolve = approval.resolve
    resolve(approved.permissions)
    this._closePopup && this._closePopup()
    delete this.pendingApprovals[id]
  }

  /**
   * User rejection callback.
   * @param {string} id the id of the rejected request
   */
  async rejectPermissionsRequest (id) {
    const approval = this.pendingApprovals[id]
    const reject = approval.reject
    reject(false) // TODO:lps:review should this be an error instead?
    this._closePopup && this._closePopup()
    delete this.pendingApprovals[id]
  }

  /**
   * A convenience method for retrieving a login object
   * or creating a new one if needed.
   *
   * @param {string} origin = The origin string representing the domain.
   */
  _initializePermissions (restoredState) {

    // TODO:permissions stop persisting permissionsDescriptions and remove this line
    const initState = { ...restoredState, permissionsRequests: [] }

    this.testProfile = {
      name: 'Default User',
    }

    this.pendingApprovals = {}

    this.permissions = new RpcCap({

      // Supports passthrough methods:
      safeMethods: SAFE_METHODS,

      // optional prefix for internal methods
      methodPrefix: METHOD_PREFIX,

      restrictedMethods: {

        'eth_autoTransact': {
          description: 'Send transactions on your behalf.',
          method: (req, res, __, end) => {
            this.newPreApprovedTransaction({
              // gas: "0x5208", // 21,000
              // gas: "0x30d40", // 200,000
              // gasPrice: "0xee6b28000", // 64 gwei
              value: "0xde0b6b3a7640000", // 1 ether
              ...req.params[0],
            }, req)
            .then((result) => {
              res.result = result
              end()
            })
            .catch((reason) => {
              res.error = reason
              end(reason)
            })
          },
        },

        'eth_accounts': {
          description: 'View Ethereum accounts.',
          method: (_, res, __, end) => {
            this.keyringController.getAccounts()
              .then((accounts) => {
                res.result = accounts
                end()
              })
              .catch((reason) => {
                res.error = reason
                end(reason)
              })
          },
        },

        // Restricted methods themselves are defined as
        // json-rpc-engine middleware functions.
        'readYourProfile': {
          description: 'Read from your profile.',
          method: (_req, res, _next, end) => {
            res.result = this.testProfile
            end()
          },
        },
        'writeToYourProfile': {
          description: 'Write to your profile.',
          method: (req, res, _next, end) => {
            const [ key, value ] = req.params
            this.testProfile[key] = value
            res.result = this.testProfile
            return end()
          },
        },
      },

      /**
       * A promise-returning callback used to determine whether to approve
       * permissions requests or not.
       *
       * Currently only returns a boolean, but eventually should return any specific parameters or amendments to the permissions.
       *
       * @param {string} domain - The requesting domain string
       * @param {string} req - The request object sent in to the `requestPermissions` method.
       * @returns {Promise<bool>} approved - Whether the user approves the request or not.
       */
      requestUserApproval: async (options) => {
        const { metadata } = options
        const { id } = metadata

        this._openPopup && this._openPopup()

        return new Promise((resolve, reject) => {
          this.pendingApprovals[id] = { resolve, reject }
        },
        // TODO: This should be persisted/restored state.
        {})

        // TODO: Attenuate requested permissions in approval screen.
        // Like selecting the account to display.
      },
    }, initState)
  }

}

module.exports = {
  PermissionsController,
  addInternalMethodPrefix: prefix,
}
