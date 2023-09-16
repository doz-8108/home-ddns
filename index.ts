import { serve } from "bun";
import xml2js from "xml2js";
import dayjs from "dayjs";
import schedule from "node-schedule";

interface IpUpdateQueryResponse {
	"interface-response": {
		Command: string[];
		Language: string[];
		IP: string[];
		ErrCount: string[];
		errors: string[];
		ResponseCount: string[];
		responses: string[];
		Done: string[];
		debug: string[];
	};
}

const { HOST, DOMAIN, DDNS_PASSWORD, PORT } = process.env;
const port = PORT || 4399;

const updateIp = async () => {
	const timestamp = dayjs(Date.now()).format("YYYY-MM-DDTHH:mm:ssZ[Z]");
	try {
		const currentIp = (
			(await (await fetch("https://api.ipify.org?format=json")).json()) as {
				ip: string;
			}
		)?.ip;
		const response = await fetch(
			`https://dynamicdns.park-your-domain.com/update?host=${HOST}&domain=${DOMAIN}&password=${DDNS_PASSWORD}&ip=${currentIp}`,
			{
				method: "GET"
			}
		);
		const xml = await response.text();
		const data = (await xml2js.parseStringPromise(
			xml
		)) as IpUpdateQueryResponse;
		if (
			data?.["interface-response"].Done?.[0] !== "true" ||
			data?.["interface-response"].ErrCount?.[0] !== "0" ||
			data?.["interface-response"].errors?.[0] !== ""
		) {
			throw new Error(
				`[${timestamp}]: ❌ Error counts=${
					data["interface-response"].ErrCount[0]
				} | ${data["interface-response"].errors
					.map(err => JSON.stringify(err))
					.join(", ")}`
			);
		}
		const successMsg = `[${timestamp}]: ✅ The current host address ${currentIp} is being sent!`;
		console.info(successMsg);
		return new Response(successMsg);
	} catch (error: unknown) {
		console.error((error as Error).message);
		return new Response((error as Error).message);
	}
};

const job = schedule.scheduleJob("0 * * * *", updateIp);

const server = serve({
	port,
	async fetch(req) {
		const url = new URL(req.url);
		if (url.pathname === "/update-ip") {
			return await updateIp();
		} else {
			console.info(
				`[${dayjs(Date.now()).format(
					"YYYY-MM-DDTHH:mm:ssZ[Z]"
				)}]: ✅ Dynamic domain name server is serving you on port ${port}!`
			);
		}

		return new Response(`✅ Finished!`);
	}
});

server.fetch("/");

if ([HOST, DDNS_PASSWORD, DOMAIN, PORT].some(env => env === undefined)) {
	console.error(
		`[${dayjs(Date.now()).format(
			"YYYY-MM-DDTHH:mm:ssZ[Z]"
		)}]: ❌ Missig environment variable!`
	);
	server.stop();
}
