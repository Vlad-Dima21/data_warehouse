import cliProgress from 'cli-progress';

export default class CliProgress {
	private bar: cliProgress.SingleBar;

	constructor(name: string) {
		this.bar = new cliProgress.SingleBar(
			{
				format: `${name}: {percentage}% || {value}/{total} items`,
			},
			cliProgress.Presets.shades_classic
		);
	}

	start(total: number, start: number) {
		this.bar.start(total, start);
	}

	update(value: number) {
		this.bar.update(value);
	}

	increment(amount = 1) {
		this.bar.increment(amount);
	}

	stop() {
		this.bar.stop();
	}
}
