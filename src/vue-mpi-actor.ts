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
import { defineComponent, Plugin } from "vue";

type MpiActorCallback = {
  id: string;
  callback: (param: any, mutable: boolean) => void;
};

const _registry: { [index: string]: MpiActorCallback[] } = {};

const deregister = (id: string) => {
  if (!id) return;
  Object.keys(_registry).forEach((chan) => {
    _registry[chan] = (_registry[chan] ?? []).filter((o) => o.id !== id);
  });
};

const register = (_channel: string, cb: MpiActorCallback) => {
  if (!_channel) return;
  _registry[_channel] = _registry[_channel] ?? [];
  _registry[_channel].push(cb);
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
  ).then((_) => true);
};

export const mpiActorPlugin: Plugin = {
  install(v, opts) {
    v.component(
      "mpi-actor",
      defineComponent({
        name: "mpi-actor",
        render(_h: any) {
          return this.$slots?.default?.call(this, {
            params: this.$data.params,
            clear: this.$data.clear,
          }) as any;
        },
        props: {
          channel: {
            type: String,
            required: true,
          },
        },
        data() {
          const _this = this as any;
          const slotData = {
            params: null,
            clear: () => (_this.params = null),
          };

          const dt = Date.now();

          const cId = `${(Math.random() * dt).toString(36)}${dt.toString(36)}`;
          Object.defineProperty(slotData, "$$mpiActorId", {
            writable: false,
            value: `mpi:${cId}:actor`,
          });

          return slotData;
        },
        watch: {
          channel: {
            immediate: true,
            handler(channelName) {
              deregister(this.$$mpiActorId);
              register(channelName, {
                id: this.$$mpiActorId,
                callback: (msg: any, mutable: boolean) => {
                  let arg: any = msg;

                  if (typeof msg === "object" && mutable === true) {
                    arg = Array.isArray(msg)
                      ? Array.from(msg)
                      : Object.assign({}, msg);
                  }

                  this.send(arg);
                },
              });
            },
          },
        },
        methods: {
          send(msg: any) {
            this.params = msg;
          },
        },
      })
    );

    v.config.globalProperties.$mpiActorSend = (msg: {
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
