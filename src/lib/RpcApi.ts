import {RpcServer, State as RpcState} from '@nimiq/rpc';
import {RootState} from '@/store';
import {Store} from 'vuex';
import Router from 'vue-router';
import {AccountsRequest, RequestType, RpcRequest} from '@/lib/RequestTypes';
import {KeyguardCommand, RequestBehavior, KeyguardClient} from '@nimiq/keyguard-client';
import {keyguardResponseRouter} from '@/router';

export default class RpcApi {

    public static createKeyguardClient(store: Store<RootState>, endpoint?: string) {
        const behavior = new RequestBehavior(undefined, RpcApi.exportState(store));
        const client = new KeyguardClient(endpoint, behavior);
        return client;
    }

    private static exportState(store: Store<RootState>): any {
        return {
            rpcState: store.state.rpcState ? store.state.rpcState.toJSON() : undefined,
            request: store.state.request ? AccountsRequest.raw(store.state.request) : undefined,
            keyguardRequest: store.state.keyguardRequest ? JSON.stringify(store.state.keyguardRequest) : undefined,
        };
    }

    private _server: RpcServer;
    private _store: Store<RootState>;
    private _router: Router;
    private _keyguardClient: KeyguardClient;

    constructor(store: Store<RootState>, router: Router) {
        this._store = store;
        this._router = router;
        this._server = new RpcServer('*');
        this._keyguardClient = new KeyguardClient();

        this._registerAccountsApis([
            RequestType.SIGNTRANSACTION,
            RequestType.CHECKOUT,
            RequestType.SIGNUP,
            RequestType.LOGIN,
        ]);
        this._registerKeyguardApis([
            KeyguardCommand.SIGN_TRANSACTION,
            KeyguardCommand.CREATE,
            KeyguardCommand.IMPORT,
        ]);
    }

    public start() {
        this._server.init();
        this._keyguardClient.init().catch(console.error); // TODO: Provide better error handling here
    }

    private _registerAccountsApis(requests: RequestType[]) {
        for (const request of requests) {
            // Server listener
            this._server.onRequest(request, async (state, arg: RpcRequest) => {
                this._store.commit('setIncomingRequest', {
                    rpcState: state,
                    request: AccountsRequest.parse(arg, request),
                });
                this._router.push({name: request});
            });
        }
    }

    private _recoverState(state: any) {
        const rpcState = RpcState.fromJSON(state.rpcState);
        const request = AccountsRequest.parse(state.request);
        const keyguardRequest = JSON.parse(state.keyguardRequest);
        this._store.commit('setIncomingRequest', {
            rpcState,
            request,
        });
        this._store.commit('setKeyguardRequest', {
            keyguardRequest,
        });
    }

    private _registerKeyguardApis(commands: KeyguardCommand[]) {
        for (const command of commands) {
            // Server listener
            this._keyguardClient.on(command, (result, state) => {
                // Recover state
                this._recoverState(state);

                // Set result
                result.kind = command;
                this._store.commit('setKeyguardResult', result);

                this._router.push({name: keyguardResponseRouter[command].resolve});
            }, (error, state) => {
                // Recover state
                this._recoverState(state);

                // Set result
                this._store.commit('setKeyguardResult', error);

                this._router.push({name: keyguardResponseRouter[command].reject});
            });
        }
    }
}
