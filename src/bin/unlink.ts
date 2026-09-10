import * as fs from 'fs';
import { parseArgs } from 'util';

const { positionals } = parseArgs({ allowPositionals: true });

if (!positionals.length) throw 'missing operand';
if (positionals.length > 1) throw `extra operand '${positionals[1]}'`;

fs.unlinkSync(positionals[0]);
