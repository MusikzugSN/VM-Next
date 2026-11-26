import { CupsBackend, isPrinting, listsJob, parseDefault, parseInfo, parseRequestId, statusMessage, type Run } from './cups-backend';

describe('CUPS output parsing', () => {
  it('reads the default printer', () => {
    expect(parseDefault('system default destination: HP_LaserJet\n')).toBe('HP_LaserJet');
    expect(parseDefault('no system default destination\n')).toBeNull();
  });

  it('reads the printer description, quoted or not', () => {
    expect(parseInfo("copies=1 printer-info='HP LaserJet M110' sides=one-sided", 'HP')).toBe('HP LaserJet M110');
    expect(parseInfo('printer-info=Brother', 'B')).toBe('Brother');
    expect(parseInfo('copies=1', 'Office_Printer')).toBe('Office Printer');
  });

  it('reads the request id of lp', () => {
    expect(parseRequestId('request id is HP_LaserJet-42 (1 file(s))\n')).toBe('HP_LaserJet-42');
    expect(parseRequestId('lp: error')).toBeNull();
  });

  it('finds jobs in lpstat lists and the job being printed', () => {
    const list = 'HP-41   anna   1024   Sat 21 Nov 2026 10:00:00\nHP-42   anna   2048   Sat 21 Nov 2026 10:01:00\n';
    expect(listsJob(list, 'HP-42')).toBe(true);
    expect(listsJob(list, 'HP-4')).toBe(false);
    expect(isPrinting('printer HP now printing HP-42.  enabled since Sat', 'HP-42')).toBe(true);
    expect(isPrinting('printer HP now printing HP-420.  enabled since Sat', 'HP-42')).toBe(false);
  });

  it('reads the status message of a completed job', () => {
    const aborted = 'PDF-1   root   10240   Thu Nov 26 17:15:58 2026\n' + '\tStatus: Backend failed\n\tAlerts: processing-to-stop-point\n\tqueued for PDF\n';
    const printed = 'PDF-4   root   10240   Thu Nov 26 17:32:05 2026\n' + '\tStatus: \n\tAlerts: processing-to-stop-point\n\tqueued for PDF\n';
    expect(statusMessage(aborted, 'PDF-1')).toBe('Backend failed');
    expect(statusMessage(printed, 'PDF-4')).toBe('');
    expect(statusMessage(aborted + printed, 'PDF-4')).toBe('');
    expect(statusMessage(printed, 'PDF-9')).toBe('');
  });
});

describe('CupsBackend', () => {
  const fake = (outputs: Record<string, string>): { run: Run; calls: string[][] } => {
    const calls: string[][] = [];
    return {
      calls,
      run: async (command, args) => {
        calls.push([command, ...args]);
        const key = [command, ...args].join(' ');
        const hit = Object.keys(outputs).find((k) => key.startsWith(k));
        if (hit === undefined) throw new Error(`unexpected ${key}`);
        return outputs[hit];
      },
    };
  };

  it('lists printers with default and description', async () => {
    const { run } = fake({
      'lpstat -e': 'HP\nBrother\n',
      'lpstat -d': 'system default destination: HP\n',
      'lpoptions -p HP': "printer-info='HP LaserJet'",
      'lpoptions -p Brother': '',
    });
    expect(await new CupsBackend(run).listPrinters()).toEqual([
      { id: 'HP', name: 'HP LaserJet', isDefault: true },
      { id: 'Brother', name: 'Brother', isDefault: false },
    ]);
  });

  it('prints duplex on the default printer without scaling', async () => {
    const { run, calls } = fake({ 'lpstat -d': 'system default destination: HP\n', 'lp ': 'request id is HP-7 (1 file(s))\n' });
    const result = await new CupsBackend(run).submit('/tmp/a.pdf', { printerId: null, duplex: true, copies: 2, title: 'Marschbuch' });
    expect(result).toEqual({ backendId: 'HP-7', printerId: 'HP' });
    expect(calls.at(-1)).toEqual(['lp', '-d', 'HP', '-n', '2', '-t', 'Marschbuch', '-o', 'sides=two-sided-long-edge', '-o', 'fit-to-page=false', '/tmp/a.pdf']);
  });

  it('maps lpstat to waiting, printing, done and failed', async () => {
    const backend = (open: string, printer: string, done: string) =>
      new CupsBackend(fake({ 'lpstat -W not-completed': open, 'lpstat -p': printer, 'lpstat -W completed': done }).run);
    const line = 'HP-7 anna 1024 Sat\n';
    expect((await backend(line, 'printer HP is idle.', '').state('HP-7', 'HP')).status).toBe('waiting');
    expect((await backend(line, 'printer HP now printing HP-7.', '').state('HP-7', 'HP')).status).toBe('printing');
    expect((await backend('', '', line).state('HP-7', 'HP')).status).toBe('done');
    expect((await backend('', '', '').state('HP-7', 'HP')).status).toBe('failed');
  });

  it('does not call an aborted job done', async () => {
    const aborted = 'HP-7 anna 1024 Sat\n\tStatus: Backend failed\n\tqueued for HP\n';
    const run = fake({ 'lpstat -W not-completed': '', 'lpstat -W completed': aborted }).run;
    expect(await new CupsBackend(run).state('HP-7', 'HP')).toEqual({ status: 'failed', printedPages: null, error: 'Backend failed' });
  });

  it('reports a failing lpstat instead of declaring the job gone', async () => {
    const failing: Run = () => Promise.reject(new Error('lpstat: Connection refused'));
    await expect(new CupsBackend(failing).state('HP-7', 'HP')).rejects.toThrow('Connection refused');
  });
});
