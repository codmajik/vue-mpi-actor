/*
MIT License

Copyright (c) 2020 Vincent Chinedu Okonkwo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
import { PluginObject } from "vue";

/* eslint-disable */
type MpiActorCallback = {
  id: string;
  callback: (param: any, mutable: boolean) => void;
};
const _registry: { [index: string]: MpiActorCallback[] } = {};

export const mpiActorPlugin: PluginObject<{ mutable?: boolean }> = {
  install(v, opts) {
    v.component("mpi-actor", {
      name: "mpi-actor",
      render(_h: any) {
        return this.$scopedSlots?.default?.call(this, {
          params: this.$data.params,
          clear: this.$data.clear,
        }) as any;
      },
      props: {
        channel: {
          type: String,
          required: true,
        },
        mutable: Boolean,
      },
      mounted() {
        const _channel = this.channel;
        if (!_channel) return;

        _registry[_channel] = _registry[_channel] ?? [];

        _registry[_channel].push({
          id: this.$data.$$mpiActorId,
          callback: (param: any, mutable: boolean) => {
            let arg: any = param;
            if (
              !(
                mutable === true ||
                this.$props.mutable === true ||
                typeof param !== "object"
              )
            ) {
              // TODO: deep copy??
              arg = Array.isArray(param)
                ? Array.from(param)
                : Object.assign({}, param);
            }

            return (this.$data.params = arg);
          },
        });
      },
      beforeDestroy() {
        const _channel = this.channel;
        if (!_channel) return;

        _registry[_channel] = (_registry[_channel] ?? []).filter(
          (o) => o.id != this.$data.$$mpiActorId
        );
      },
      methods: {
        clear() {
          this.params = null;
        }
      },
      data() {
        const _this = this as any;
        const slotData = {
          params: null,
          clear: () => (_this.params = null),
        };

        Object.defineProperty(slotData, "$$mpiActorId", {
          writable: false,
          value: `mpi-actor:${(Math.random() * Date.now()).toString(
            32
          )}-${Date.now().toString(32)}`,
        });

        return slotData;
      },
    });

    v.prototype.$mpiActorSend = (msg: {
      channel: string;
      data: any;
      mutable?: boolean;
    }) => {
      if (!msg) return;

      if (!_registry[msg.channel]) {
        console?.warn(`nobody is waiting on channel ${msg?.channel}`);
        return;
      }

      const mutable = msg?.mutable ?? opts?.mutable ?? false;

      _registry[msg.channel]?.forEach((s) => s?.callback(msg.data, mutable));

      //
      return Promise.resolve(true);
    };
  },
};

export default mpiActorPlugin;
