# HTML to JPG

A free, open-source HTML-to-JPEG tool. Pasted HTML is rendered in the visitor's browser; it is not uploaded to a rendering server.

The editor is CodeMirror 6 with HTML syntax highlighting, line numbers, folding, autocomplete, bracket matching, search, and an IDE dark theme. The renderer disables scripts in an isolated preview. Rendering uses `html-to-image`, so advanced CSS and cross-origin resources may not capture exactly as Chromium's native screenshot API would. External URLs in pasted markup can still be contacted by the visitor's browser.

## Run

```sh
npm install
npm run build
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Set `PORT` to change the port.

## Verify

```sh
npm test
```

The local server binds to `127.0.0.1`. Vercel deploys the generated `public` directory as a static site; HTML rendering runs in each visitor's browser. Static assets are served globally by Vercel. The canonical launch domain is `https://html2image.aminbihamta.com/`. The GA4 measurement ID is configured in `src/app.js`; run `npm run build` after changing it.

Analytics is optional and loads only after explicit opt-in. The privacy page is a launch draft and should be updated with final operator and hosting details. The app links to [aminbihamta.com](https://aminbihamta.com/).

## License

The app is released under the MIT license. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md) for dependency terms.
