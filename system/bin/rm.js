if (!args[1]) {
	throw 'No path provided';
}
fs.unlinkSync(args[1]);
