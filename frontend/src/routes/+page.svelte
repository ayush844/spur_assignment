<script lang="ts">
  import ChatWidget from '$lib/ChatWidget.svelte';
</script>

<main>
  <div class="hero">
    <span class="badge">Cozy Threads</span>
    <h1>Sustainable loungewear,<br />delivered with care.</h1>
    <p>Questions about shipping, returns, or your order? Our AI support agent is here to help.</p>
  </div>
  <ChatWidget />
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 64px;
    padding: 40px 24px;
    background: linear-gradient(160deg, #dfe6e9 0%, #f8f9fa 50%, #dfe6e9 100%);
  }

  .hero {
    max-width: 400px;
  }

  .badge {
    display: inline-block;
    background: #2d3436;
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 6px 12px;
    border-radius: 4px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 2.2rem;
    font-weight: 600;
    line-height: 1.2;
    margin: 0 0 16px;
    color: #2d3436;
  }

  p {
    font-size: 16px;
    line-height: 1.6;
    color: #636e72;
    margin: 0;
  }

  @media (max-width: 860px) {
    main {
      flex-direction: column;
      gap: 32px;
      text-align: center;
    }

    h1 {
      font-size: 1.75rem;
    }
  }
</style>
