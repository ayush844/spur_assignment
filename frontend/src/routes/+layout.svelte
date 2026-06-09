<script lang="ts">
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: 'DM Sans', system-ui, sans-serif;
    background: #f0f2f5;
    color: #2d3436;
    -webkit-font-smoothing: antialiased;
  }
</style>
