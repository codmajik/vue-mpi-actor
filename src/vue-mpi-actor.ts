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

/* eslint-disable */
type MpiActorCallback = { id: string; callback: (param: any) => void };
const _registry: { [index: string]: MpiActorCallback[] } = {};

const _mpiActorComponent: any = {
  name: "mpi-actor",
  render(_h: any) {
    return this.$scopedSlots!.default!.call(this, {
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
      callback: (param: any) => {
        const arg =
          this.$props.mutable === true || typeof param !== "object"
            ? param
            : Array.isArray(param)
            ? Array.from(param)
            : Object.assign({}, param);
        return (this.$data.params = arg);
      },
    });
  },
  beforeDestroy() {
    const _channel = this.channel ?? this.hook;
    if (!_channel) return;

    _registry[_channel] = (_registry[_channel] ?? []).filter(
      (o) => o.id != this.$data.$$mpiActorId
    );
  },
  data() {
    const paramDefault: any = null;
    const _this = this as any;

    const slotData = {
      params: paramDefault,
      clear: () => (_this.params = paramDefault),
    };

    Object.defineProperty(slotData, "$$mpiActorId", {
      writable: false,
      value: `mpi-actor:${(Math.random() *
        Date.now() *
        Date.now()).toString(32)}-${Date.now().toString(32)}`,
    });

    return slotData;
  },
};

const _mpiActorSend = (msg: { channel: string; data: any }) => {
  if (!_registry[msg.channel]) {
    console.warn(`nobody is waiting for hook ${msg.channel}`);
    return;
  }

  _registry[msg.channel]?.forEach((s) => s?.callback(msg.data));
};

export const mpiActorPlugin = {
  install(v: any, opts: any) {
    v.component("mpi-actor", _mpiActorComponent);
    v.prototype.$mpiSend = (hook: string, params: any) => {
      return _mpiActorSend({ channel: hook, data: params });
    };
    v.prototype.$mpiActorSend = _mpiActorSend;
  },
};


export default mpiActorPlugin;
