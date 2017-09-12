import * as path from "path";

import * as express from "express";
import * as serveStatic from "serve-static";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import * as morgan from "morgan";
import flash = require("connect-flash");

import {
	// Constants
	PORT, STATIC_ROOT, VERSION_NUMBER, VERSION_HASH, COOKIE_OPTIONS,
	// Configuration
	config
} from "./common";
import {
	User
} from "./schema";

// Set up Express and its middleware
export let app = express();
app.use(morgan("dev"));
app.use(compression());
let cookieParserInstance = cookieParser(undefined, COOKIE_OPTIONS);
app.use(cookieParserInstance);
app.use(flash());

// Throw and show a stack trace on an unhandled Promise rejection instead of logging an unhelpful warning
process.on("unhandledRejection", err => {
	throw err;
});

// Check for number of admin users and warn if none
(async () => {
	let users = await User.find({"admin": true});
	if (users.length !== 0) {
		return;
	}
	console.warn("No admin users are configured; admins can be added in config.json");
})().catch(err => {
	throw err;
});

// Auth needs to be the first route configured or else requests handled before it will always be unauthenticated
import {authRoutes} from "./routes/auth";
app.use("/auth", authRoutes);

// Metrics
import {trackEvent} from "./common";
app.use((request, response, next) => {
	// Track endpoints without extensions
	if (path.extname(request.url) === "") {
		let email: string | undefined = request.user ? request.user.email : undefined;
		trackEvent("visit", request, email);
	}
	next();
});

let apiRouter = express.Router();
// API routes go here
import {userRoutes} from "./routes/api/user";
apiRouter.use("/user/:id", userRoutes);
import {adminRoutes} from "./routes/api/admin";
apiRouter.use("/admin", adminRoutes);
import {settingsRoutes} from "./routes/api/settings";
apiRouter.use("/settings", settingsRoutes);

app.use("/api", apiRouter);

// Uploaded file downloading for admins
import {uploadsRoutes} from "./routes/uploads";
app.use("/uploads", uploadsRoutes);

// User facing routes
import {templateRoutes} from "./routes/templates";
app.use("/", templateRoutes);
app.route("/version").get((request, response) => {
	response.json({
		"version": VERSION_NUMBER,
		"hash": VERSION_HASH,
		"node": process.version
	});
});

app.use("/node_modules", serveStatic(path.resolve(__dirname, "../node_modules")));
app.use("/js", serveStatic(path.resolve(STATIC_ROOT, "js")));
app.use("/css/theme.css", serveStatic(config.style.theme));
app.use("/favicon.ico", serveStatic(config.style.favicon));
app.use("/css", serveStatic(path.resolve(STATIC_ROOT, "css")));

app.listen(PORT, () => {
	console.log(`Registration system v${VERSION_NUMBER} @ ${VERSION_HASH} started on port ${PORT}`);
});
