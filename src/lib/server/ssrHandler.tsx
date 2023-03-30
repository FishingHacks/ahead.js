// @ts-ignore
import routerData from './.ssr';
import React from 'react';
import { RouteObject } from 'react-router-dom';
import {
	createStaticHandler,
	createStaticRouter,
	StaticRouterProvider,
} from 'react-router-dom/server';
import { readFile } from 'fs/promises';
import { renderToString } from 'react-dom/server';
import path from 'path';
import express from 'express';

const routes: RouteObject[] = routerData;

/* 
Credit to the React Router team for the createFetchRequest method:
https://github.com/remix-run/react-router/blob/5a43e19573c11d1469fd43ef1fddaf7be02abca5/examples/ssr-data-router/src/entry.server.tsx#L32-L65
*/

export default async function handleSSR(req: express.Request) {
	const htmlTemplate = await readFile(
		path.join(__dirname, '..', 'client', 'index.html'),
		'utf-8',
	);

	// create a static router using React Router
	const { dataRoutes, query } = createStaticHandler(routes);

	const fetchRequest = createFetchRequest(req);
	const ctx = await query(fetchRequest);

	if (ctx instanceof Response) {
		throw ctx;
	}

	const router = createStaticRouter(dataRoutes, ctx);

	const html = htmlTemplate.replace(
		'<div id="root"></div>',
		await renderToString(
			<React.StrictMode>
				<div id='root'>
					<StaticRouterProvider router={router} context={ctx} />
				</div>
			</React.StrictMode>,
		),
	);

	return html;
}

function createFetchRequest(req: express.Request): Request {
	let origin = `${req.protocol}://${req.get('host')}`;
	// Note: This had to take originalUrl into account for presumably vite's proxying
	let url = new URL(req.originalUrl || req.url, origin);

	let controller = new AbortController();
	req.on('close', () => controller.abort());

	let headers = new Headers();

	for (let [key, values] of Object.entries(req.headers)) {
		if (values) {
			if (Array.isArray(values)) {
				for (let value of values) {
					headers.append(key, value);
				}
			} else {
				headers.set(key, values);
			}
		}
	}

	let init: RequestInit = {
		method: req.method,
		headers,
		signal: controller.signal,
	};

	if (req.method !== 'GET' && req.method !== 'HEAD') {
		init.body = req.body;
	}

	return new Request(url.href, init);
}
