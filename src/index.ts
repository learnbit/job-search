import { GreenhouseCollector } from "./collectors/greenhouse/GreenhouseCollector.js";
import type { GreenhouseBoard } from "./collectors/greenhouse/types.js";

const [boardToken, companyName] = process.argv.slice(2);

if (!boardToken || !companyName) {
  console.error(
    'Usage: npm run dev -- <board-token> "<company-name>"\n' +
      'Example: npm run dev -- example-company "Example Company"',
  );
  process.exitCode = 1;
} else {
  const boards: GreenhouseBoard[] = [{ boardToken, companyName }];
  const collector = new GreenhouseCollector();
  const jobs = await collector.collect(boards);

  console.log(JSON.stringify(jobs, null, 2));
}
