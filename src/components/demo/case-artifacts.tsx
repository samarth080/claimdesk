import {
  ARTIFACT_KIND_LABELS,
  type CaseArtifact,
} from "@/lib/demo/artifacts";

function ArtifactBody({ artifact }: { artifact: CaseArtifact }) {
  if (artifact.log) {
    return (
      <pre className="overflow-x-auto px-4 py-3 font-mono text-micro leading-5 text-zinc-700">
        {artifact.log.join("\n")}
      </pre>
    );
  }

  return (
    <dl className="divide-y divide-zinc-100">
      {(artifact.fields ?? []).map((field) => (
        <div
          key={field.label}
          className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-3 px-4 py-2"
        >
          <dt className="font-mono text-micro uppercase tracking-[0.1em] text-zinc-400">
            {field.label}
          </dt>
          <dd
            className={`font-mono text-mini leading-5 ${
              field.emphasis
                ? "font-semibold text-zinc-950"
                : "text-zinc-700"
            }`}
          >
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CaseArtifacts({ artifacts }: { artifacts: CaseArtifact[] }) {
  if (artifacts.length === 0) return null;

  return (
    <section aria-labelledby="case-artifacts-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-2.5">
        <div className="flex items-baseline gap-3">
          <h3
            id="case-artifacts-title"
            className="text-lead font-semibold tracking-tight text-zinc-950"
          >
            Where the evidence comes from
          </h3>
          <p className="text-mini text-zinc-500">
            Sample documents behind the fields above
          </p>
        </div>
        <p className="font-mono text-micro uppercase tracking-[0.12em] text-zinc-500">
          {artifacts.length} artifact{artifacts.length === 1 ? "" : "s"}
        </p>
      </div>

      <p className="mt-3 border-l-2 border-amber-400 bg-amber-50/50 px-3 py-2 text-detail leading-5 text-zinc-700">
        These are illustrative samples, not engine inputs. The rules read the
        structured records shown in stage 1; each document below is what that
        record looks like in the system it came from.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {artifacts.map((artifact) => (
          <figure
            key={artifact.id}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
          >
            <figcaption className="border-b border-zinc-100 brand-subtle px-4 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-body font-semibold text-zinc-900">
                  {artifact.title}
                </p>
                <span className="border border-zinc-300 px-1.5 py-0.5 rounded-full font-mono text-micro uppercase tracking-[0.1em] text-zinc-500">
                  Sample · {ARTIFACT_KIND_LABELS[artifact.kind]}
                </span>
              </div>
              <p className="mt-1 truncate font-mono text-micro text-zinc-500">
                {artifact.source}
              </p>
              <p className="font-mono text-micro text-zinc-400">
                {artifact.meta}
              </p>
            </figcaption>

            <ArtifactBody artifact={artifact} />

            <div className="border-t border-zinc-100 brand-subtle px-4 py-2.5">
              <p className="font-mono text-micro uppercase tracking-[0.12em] text-zinc-500">
                Read by rule · {artifact.citedBy}
              </p>
              <p className="mt-1 text-detail leading-5 text-zinc-700">
                {artifact.citation}
              </p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                {artifact.corroborates.map((field) => (
                  <span
                    key={field}
                    className="border border-zinc-200 bg-white px-1.5 py-0.5 rounded-full font-mono text-micro text-zinc-600"
                  >
                    {field}
                  </span>
                ))}
              </p>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
