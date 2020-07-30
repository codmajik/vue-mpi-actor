import Vue from "vue";

declare module "vue/types/vue" {
  interface VueConstructor {
    $mpiActorSend(msg: { channel: string; data: any; mutable?: boolean }): PromiseLike<any>;
  }

  interface Vue {
    $mpiActorSend(msg: { channel: string; data: any; mutable?: boolean }): PromiseLike<any>;
  }
}
