(async () => {
    process.env.TOOL_AUTO_RETRY = '1';
    process.env.TOOL_EXECUTION_MODE = 'synchronous';

    // Import after setting env so AI_CONFIG picks up values
    const actions = await import('../src/app/actions');

    console.log('Running smoke test: executeWithRetry on missing tool "__not_a_tool__"');
    const res = await actions.executeWithRetry('__not_a_tool__', {});
    console.log('Result:', res);

    console.log('\nSmoke test complete. If you see a retry log and a graceful failure result, the retry wrapper is working.');
})();