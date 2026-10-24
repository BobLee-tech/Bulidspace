import Image from "next/image";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { T } from "@/components/t";
import { shortUrl } from "@/lib/event-live";
import { worksOnWall, type EventResults } from "@/lib/event-results";

/**
 * What came out of an event, under the intro once it's over: a sentence,
 * the head-counts, then everyone's work. Each part shows only when filled in
 * (src/lib/event-results.ts).
 */
export function EventResultsSection({ results }: { results: EventResults }) {
  const works = results.works ?? [];
  const stats = [
    ...(results.stats ?? []),
    ...(works.length
      ? [
          {
            value: worksOnWall(results),
            label: { zh: "个网站上墙", en: "sites on the wall" },
          },
        ]
      : []),
  ];
  return (
    <section className="evp-results" id="results">
      <h2 className="evp-sec-h mono mute">
        <T zh="活动成果" en="Results" />
      </h2>
      {results.recap && (
        <p className="evp-recap">
          <T {...results.recap} />
        </p>
      )}
      {stats.length > 0 && (
        <dl className="evp-stats">
          {stats.map((s) => (
            <div key={s.label.en}>
              <dt className="mono mute">
                <T {...s.label} />
              </dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {works.length > 0 && (
        <div className="evp-sec">
          <h3 className="evp-sec-h mono mute">
            <T zh="个人成果墙" en="The wall" />
          </h3>
          <ul className="evp-wall">
            {works.map((w) => (
              <li key={w.url}>
                <a
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evp-work"
                >
                  <span className="evp-work-shot">
                    {/* The name and address below say what it is. */}
                    <Image
                      src={w.shot}
                      alt=""
                      width={1280}
                      height={800}
                      sizes="(max-width: 640px) 50vw, (max-width: 1280px) 34vw, 420px"
                    />
                  </span>
                  <span className="evp-work-meta">
                    <b>
                      {w.name}
                      {w.organiser && (
                        <span className="tag dash">
                          <T zh="组织者 · 示范" en="Organiser · demo" />
                        </span>
                      )}
                    </b>
                    <span className="mono mute evp-work-url">
                      <span>{shortUrl(w.url)}</span>
                      <ArrowUpRight weight="light" size={14} aria-hidden />
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mute evp-wall-note">
            <T
              zh="只放本人同意展示的网站。想加上自己的，或者想撤下，跟我们说一声。"
              en="Only sites their makers agreed to show. Want yours added or taken down? Just tell us."
            />
          </p>
        </div>
      )}
    </section>
  );
}
