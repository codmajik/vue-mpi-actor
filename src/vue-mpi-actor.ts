/*
MIT License

Copyright (c) 2020 Vincent Chinedu Okonkwo (codmajik@gmail.com)

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

import {
  defineComponent,
  onBeforeUnmount,
  onUpdated,
  Plugin,
  readonly,
  ref,
  watch,
} from "vue";

type MpiActorCallback = {
  id: string;
  callback: (param: any, mutable: boolean) => void;
};

type ResponseAction<T> = {
  resolve: (value?: T) => void;
  reject: (error?: T) => void;
};

const _registry: { [index: string]: MpiActorCallback[] } = {};

const deregister = (_channel: string, id: string) => {
  if (!_channel || !id) return;
  const regIdx = (_registry[_channel] ?? []).findIndex((cb) => cb.id != id);
  if (regIdx > -1) {
    _registry[_channel].splice(regIdx, 1);
  }
};

const register = (_channel: string, cb: MpiActorCallback) => {
  if (!_channel) return;
  _registry[_channel] = _registry[_channel] ?? [];
  _registry[_channel].push(cb);
};

const responder = <T>(): { value: Promise<any>; action: ResponseAction<T> } => {
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

export const mpiActorPlugin: Plugin = {
  install(v, opts) {
    const xvalue = (param: any, mutable?: boolean) => {
      let arg: any = param;

      if (mutable === true && typeof param === "object") {
        // TODO: deep copy??
        arg = Array.isArray(param)
          ? Array.from(param)
          : Object.assign({}, param);
      }

      return arg;
    };

    v.component(
      "mpi-actor",
      defineComponent({
        name: "mpi-actor",
        render() {
          return this.$slots?.default({
            params: this.params,
            clear: this.clear,
            result: this.responder,
          });
        },
        setup(props) {
          const dt = Date.now();
          const params = ref<any>(null);
          const responder = ref<ResponseAction<any>>();

          const mpiActorId = readonly(
            ref(
              `mpi-actor:${(Math.random() * dt).toString(36)}${dt.toString(36)}`
            )
          );

          watch(
            () => props.channel,
            (val, old) => {
              if (old) deregister(old, mpiActorId.value);
              register(val, {
                id: mpiActorId.value,
                callback: (msg, mutable) => {
                  params.value = xvalue(msg, mutable || props.mutable);
                },
              });
            },
            {
              immediate: true,
            }
          );

          onBeforeUnmount(() => {
            if(props.channel) {
              deregister(props.channel, mpiActorId.value);
            }
          });

          return {
            params,
            responder,
            clear: () => (params.value = null),
          };
        },
        props: {
          channel: {
            type: String,
            required: true,
          },
          mutable: Boolean,
        },

        methods: {
          send(param: any, mutable?: boolean) {
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

            this.params.value = xvalue(param, mutable || this.mutable);

            const resp = responder();
            this.responder.value = resp.action;

            return resp.value;
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
