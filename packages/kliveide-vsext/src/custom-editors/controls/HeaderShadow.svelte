<script>
  // ==========================================================================
  // Displays a shadow under a header panel
</script>

<style>
  .shadow {
    width: 100%;
    box-shadow: #000000 0 6px 6px -6px inset;
    flex-grow: 0;
    flex-shrink: 0;
    position: relative;
    top: 0;
    left: 0;
    height: 6px;
    z-index: 10;
  }
</style>

<div>
  <div class="shadow" />
</div>
