<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedAddAccountRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import { DeriveAddressRequest } from '@nimiq/keyguard-client';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { WalletType } from '@/lib/WalletInfo';

@Component({})
export default class AddAccount extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedAddAccountRequest;

    public async created() {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) {
            this.rpcState.reply(ResponseStatus.ERROR, 'Wallet not found');
            return;
        }
        if (wallet.type === WalletType.LEGACY) {
            this.rpcState.reply(ResponseStatus.ERROR, 'Cannot add account to single-account wallet');
            return;
        }

        let firstIndexToDerive = 0;

        const latestAccount = Array.from(wallet.accounts.values()).pop();
        if (latestAccount) {
            const pathArray = latestAccount.path.split('/');
            firstIndexToDerive = parseInt(pathArray[pathArray.length - 1], 10) + 1;
        }

        const request: DeriveAddressRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            baseKeyPath: `m/44'/242'/0'`,
            indicesToDerive: new Array(14).fill(null).map((_: any, i: number) => `${firstIndexToDerive + i}'`),
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.deriveAddress(request).catch(console.error); // TODO: proper error handling
    }
}
</script>