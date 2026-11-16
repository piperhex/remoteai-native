import { registerRootComponent } from 'expo';
import { useEffect } from 'react';
import { runNativeP2pBenchmark, type BenchmarkOptions } from './p2pBenchmarkClient';

const control = 'http://127.0.0.1:18786';

async function run() {
  const response = await fetch(`${control}/config`);
  if (!response.ok) throw new Error('Benchmark configuration unavailable');
  const options = await response.json() as BenchmarkOptions;
  return runNativeP2pBenchmark(options);
}

function App() {
  useEffect(() => {
    void run().then(result => fetch(`${control}/result`, { method: 'POST', body: JSON.stringify(result) }))
      .catch((error: unknown) => fetch(`${control}/result`, { method: 'POST',
        body: JSON.stringify({ failed: true, reason: error instanceof Error && error.message.startsWith('Native ')
          ? error.message : 'configuration_or_transfer' }) }));
  }, []);
  return null;
}

registerRootComponent(App);
