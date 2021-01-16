import {ComponentCustomProps, Component} from "vue";

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $mpiActorSend(msg: { channel: string; data: any; mutable?: boolean }): PromiseLike<boolean>;
  }

  // interface ComponentCustomProps {
  //   $mpiActorSend(msg: { channel: string; data: any; mutable?: boolean }): PromiseLike<any>;
  // }
}
