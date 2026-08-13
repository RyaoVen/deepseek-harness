# @deepseek-ai/dsh-client-ui-usage-dashboard

English | [中文](README.zh.md)

Model consumption dashboard, browser half: one section inside the settings shell that renders the host `usageDashboard/summarize` Remote as four hand-rolled SVG charts — a 12-week calendar heatmap of call intensity, a radar "star" chart of the top models across five normalized usage dimensions (calls, input, output, cache read, cache write), a 30-day total-token trend line, and a per-model share donut with legend. Styling uses the theme tokens only, so the charts follow accent and dark-mode automatically.

The section is registered into `settings.section` (id `usage`, order 10, before the Plugins section) with a refresh button and loading, failure, and empty states. The controller owns the load lifecycle: the first read happens on mount, a refresh is refused while one is in flight, and a failed read flags the section until the next refresh. All chart shapes are pure projections of the summary, so the renderer stays a dumb SVG painter.

## Model Experience

None, as this browser-side settings surface renders a read-only summary and registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **UTC-bucketed axes** — the heatmap and trend read the host's UTC day buckets, so a deployment far from UTC sees its calendar shift; local-time axes belong to the client and are deferred.
- **Four series colors** — the radar and donut keep the top four models; further models are omitted rather than repeated in recycled colors.
- **Static 30-day trend** — the trend window is fixed; a range selector is deferred.
