import { getAllLogs } from '@/app/actions';
import TrackerUI from '@/components/TrackerUI';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const logs = await getAllLogs();
  return <TrackerUI initialLogs={logs} />;
}
