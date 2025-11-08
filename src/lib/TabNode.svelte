<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  interface TabNodeData {
    label: string;
    url: string;
    favIconUrl?: string;
  }

  export let data: TabNodeData;
  export let selected: boolean = false;
</script>

<div
  class="bg-card border-primary/50  border-3 rounded-lg px-4 py-3 shadow-md hover:border-primary hover:shadow-lg transition-all duration-200 cursor-pointer box-border"
  class:border-border={!selected}
  class:border-indigo-500={selected}
  class:shadow-xl={selected}
  style="width: 450px; height: 100px;"
>
  <Handle type="target" position={Position.Top} />

  <div class=" flex w-full h-full items-center gap-2">
    {#if data.favIconUrl}
      <img
        src={data.favIconUrl}
        alt=""
        class="w-8 h-8 shrink-0 mt-0.5 rounded"
        on:error={(e) => e.target.style.display = 'none'}
      />
    {/if}
    <div class="text-lg overflow-hidden text-ellipsis leading-snug line-clamp-2">
      {data.label}
    </div>
  </div>

  <Handle type="source" position={Position.Bottom} />
</div>
