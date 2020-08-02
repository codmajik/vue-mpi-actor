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

type MpiActorCallback = {
  id: string;
  callback: (param: any, mutable: boolean) => Promise<any>;
};

type ResponseAction = {
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
};

const _registry: { [index: string]: MpiActorCallback[] } = {};

const deregister = (_channel: string, id: string) => {
  if (!_channel || !id) return;
  _registry[_channel] = (_registry[_channel] ?? []).filter((o) => o.id != id);
};

const register = (_channel: string, cb: MpiActorCallback) => {
  if (!_channel) return;
  _registry[_channel] = _registry[_channel] ?? [];
  _registry[_channel].push(cb);
};

const responder = (): { value: Promise<any>; action: ResponseAction } => {
  let resolveFn, rejectFn;

  return {
    value: new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    }),
    action: {
      resolve: resolveFn as any,
      reject: rejectFn as any,
    },
  };
};

export const mpiActorSend = (msg: {
  channel: string;
  data: any;
  mutable?: boolean;
}) => {
  if (!msg?.channel?.trim()?.length)
    return Promise.reject("error: missing channel");

  const _chan = msg.channel.trim();

  if (!_registry[_chan]) {
    return Promise.resolve(false);
  }

  const mutable = msg?.mutable ?? false;
  return Promise.race(
    _registry[_chan]?.map((s) => s?.callback(msg.data, mutable))
  );
};

export const mpiActorPlugin: PluginObject<{ mutable?: boolean }> = {
  install(v, opts) {
    v.component("mpi-actor", {
      name: "mpi-actor",
      render(_h: any) {
        return this.$scopedSlots?.default?.call(this, {
          params: this.$data.params,
          clear: this.$data.clear,
          answer: this.$data.responder,
        }) as any;
      },
      props: {
        channel: {
          type: String,
          required: true,
        },
        mutable: Boolean,
      },
      data() {
        const _this = this as any;
        const slotData = {
          responder: (null as unknown) as ResponseAction,
          params: null,
          clear: () => (_this.params = null),
        };

        const dt = Date.now();

        Object.defineProperty(slotData, "$$mpiActorId", {
          writable: false,
          value: `mpi-actor:${(Math.random() * dt).toString(36)}${dt.toString(
            36
          )}`,
        });

        return slotData;
      },
      watch: {
        channel: {
          immediate: true,
          handler(val, oldVal) {
            deregister(oldVal, this.$data.$$mpiActorId);
            register(val, {
              id: this.$data.$$mpiActorId,
              callback: (param: any, mutable: boolean) => {
                let arg: any = param;

                if (
                  !(
                    mutable === true ||
                    this.mutable === true ||
                    typeof param !== "object"
                  )
                ) {
                  // TODO: deep copy??
                  arg = Array.isArray(param)
                    ? Array.from(param)
                    : Object.assign({}, param);
                }

                const resp = responder();
                this.params = arg;
                this.responder = resp.action;
                return resp.value;
              },
            });
          },
        },
      },
      methods: {
        send(arg: any) {
          // TODO: Do we care about the mutability rule here???

          const resp = responder();
          this.params = arg;
          this.responder = resp.action;
          return resp.value;
        },
      },
    });

    v.$mpiActorSend = v.prototype.$mpiActorSend = (msg: {
      channel: string;
      data: any;
      mutable?: boolean;
    }) => {
      if (msg && opts?.mutable) {
        msg.mutable = msg?.mutable ?? opts?.mutable ?? false;
      }

      return mpiActorSend(msg);
    };
  },
};

export default mpiActorPlugin;
