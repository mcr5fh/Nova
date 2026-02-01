import { Layout } from '@/components/Layout';
import { TaskTreeDemo } from '@/components/TaskTree/TaskTree.demo';
import { AnalyticsDemo } from '@/components/Analytics/AnalyticsDemo';
import { TraceTable } from '@/components/TraceTable';
import { mockTraces } from '@/data/mockTraces';
import './App.css';

function App() {
  return (
    <Layout>
      <div className="space-y-8">
        <AnalyticsDemo />
        <TaskTreeDemo />

        {/* TraceTable Demo */}
        <div className="bg-card rounded-lg shadow-card p-6">
          <h2 className="text-xl font-semibold text-text-0 mb-4">
            Trace Events Table
          </h2>
          <TraceTable
            traces={mockTraces}
            onRowClick={(trace) => {
              console.log('Clicked trace:', trace);
            }}
          />
        </div>
      </div>
    </Layout>
  );
}

export default App;
