import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, mapAlbum, mapGalleryCategory, mapPhoto, publicApi, usePublicFeed } from '../api/public.js';
import { friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import '../styles/gallery.css';

function AlbumDetail({ slug }) {
  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getAlbumBySlug(slug).then((a) => (a ? mapAlbum(a) : null)),
    `album-${slug}`,
  );

  return (
    <div className="page-gallery">
      <div className="album-detail section-frame">
        <Link to="/gallery" className="back-pill">← All albums</Link>
        {loading ? (
          <div className="detail-skeleton" role="status" aria-label="Loading album">
            <div className="skel-photo" aria-hidden="true" />
            <div className="skel-line" aria-hidden="true" />
            <div className="skel-line short" aria-hidden="true" />
            <span className="gdg-visually-hidden">Loading album…</span>
          </div>
        ) : null}
        {!loading && (error || !data) ? (
          <div className="gal-error" role="alert">
            <p>{error ? friendlyFeedError(error) : 'This album is not published.'}</p>
            <button type="button" onClick={retry}>Retry</button>
          </div>
        ) : null}
        {!loading && !error && data ? (
          <>
            <h2>{data.title}</h2>
            {data.description ? <p className="sub">{data.description}</p> : null}
            <div className="detail-meta">
              {data.categoryName ? <span>{data.categoryName}</span> : null}
              {data.date ? <span>{formatDate(data.date)}</span> : null}
              <span>{data.items.length} Photos</span>
            </div>
          </>
        ) : null}

        {!loading && !error && data?.items?.length ? (
          <div className="detail-grid">
            {data.items.map((photo) => (
              <figure key={photo.id} className="detail-photo">
                {photo.url ? (
                  <img src={photo.url} alt={photo.alt} loading="lazy" onError={hideImage} />
                ) : (
                  <div className="photo-fallback" aria-hidden="true">No image</div>
                )}
                {photo.caption ? <figcaption>{photo.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        ) : null}
        {!loading && !error && data && data.items.length === 0 ? (
          <div className="gal-empty">
            <strong>No photos in this album yet.</strong>
            <span>Check back soon — we are still uploading.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Gallery() {
  const { slug } = useParams();
  if (slug) return <AlbumDetail slug={slug} />;
  return <GalleryList />;
}

function GalleryList() {
  const [filter, setFilter] = useState('all');

  const { data: categoryData } = usePublicFeed(
    () => publicApi.getGalleryCategories().then((rows) => rows.map(mapGalleryCategory).sort((a, b) => a.order - b.order)),
    'gallery-categories',
  );
  const categories = useMemo(() => categoryData ?? [], [categoryData]);
  const activeLabel = filter === 'all'
    ? null
    : (categories.find((c) => c.slug === filter)?.name ?? filter);

  const { data: albumsData, loading: albumsLoading, error: albumsError, retry: albumsRetry } = usePublicFeed(
    () => publicApi.getAlbums(filter === 'all' ? undefined : { category: filter }).then((rows) => rows.map(mapAlbum)),
    `gallery-albums-${filter}`,
  );

  const { data: featuredData, loading: featuredLoading, error: featuredError, retry: featuredRetry } = usePublicFeed(
    () => publicApi.getFeaturedPhotos().then((rows) => rows.map(mapPhoto)),
    'gallery-featured',
  );

  const albumsEmpty = !albumsLoading && !albumsError && (!albumsData || albumsData.length === 0);
  const featuredEmpty = !featuredLoading && !featuredError && (!featuredData || featuredData.length === 0);
  const featuredPhoto = !featuredLoading && !featuredError && featuredData?.length ? featuredData[0] : null;

  return (
    <div className="page-gallery">
      {/* ---------- HERO ---------- */}
      <section className="gal-hero" aria-labelledby="gallery-title">
        <img className="gal-deco gal-deco-star" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <img className="gal-deco gal-deco-arrow" src="/layout-assets/home/arrow-no-bg.png" alt="" aria-hidden="true" />
        <img className="gal-deco gal-deco-globe" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
        <img className="gal-deco gal-deco-heart" src="/layout-assets/home/heart-no-bg.png" alt="" aria-hidden="true" />

        <div className="gal-hero-content">
          <div className="eyebrow"><span /> GALLERY</div>
          <h1 id="gallery-title">
            See the community<br />
            in{' '}
            <span className="action-card" aria-label="Action">
              <span className="c-blue">A</span>
              <span className="c-red">C</span>
              <span className="c-yellow">T</span>
              <span className="c-blue">I</span>
              <span className="c-green">O</span>
              <span className="c-red">N</span>
            </span>
          </h1>
          <p className="sub">
            Workshops, events, late-night builds, new connections, and the
            moments in between.
          </p>
          <a className="green-pill" href="#captured-moments">
            View the gallery <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {/* ---------- CAPTURED MOMENTS ---------- */}
      <section id="captured-moments" className="gal-captured section-frame" aria-label="Captured moments">
        <div className="section-rule" />
        <img className="gal-deco gal-deco-globe-captured" src="/layout-assets/home/globe-no-bg.png" alt="" aria-hidden="true" />
        <img className="gal-deco gal-deco-star-captured" src="/layout-assets/home/star-no-bg.png" alt="" aria-hidden="true" />
        <h2>Captured Moments</h2>

        <div className="filter-pills" role="tablist" aria-label="Filter albums">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`filter-pill${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.slug ?? c.id}
              type="button"
              role="tab"
              aria-selected={filter === c.slug}
              className={`filter-pill${filter === c.slug ? ' active' : ''}`}
              onClick={() => setFilter(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {albumsLoading ? (
          <div className="album-grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="album-skeleton" />
            ))}
          </div>
        ) : null}

        {!albumsLoading && albumsError ? (
          <div className="gal-error" role="alert">
            <p>{friendlyFeedError(albumsError)}</p>
            <button type="button" onClick={albumsRetry}>Retry</button>
          </div>
        ) : null}

        {albumsEmpty ? (
          <div className="gal-empty" role="status">
            <strong>
              {activeLabel
                ? `No ${activeLabel.toLowerCase()} albums yet.`
                : 'No albums published yet — check back soon.'}
            </strong>
            <span>
              {activeLabel
                ? 'Try another filter or check All.'
                : 'We are curating new galleries from recent GDGoC events.'}
            </span>
          </div>
        ) : null}

        {!albumsLoading && !albumsError && (albumsData ?? []).length > 0 ? (
          <div className="album-grid">
            {(albumsData ?? []).map((album) => (
              <Link
                key={album.id}
                to={album.slug ? `/gallery/${album.slug}` : '/gallery'}
                className="moment"
                aria-label={`Open album ${album.title}`}
              >
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={album.coverAlt} loading="lazy" onError={hideImage} />
                ) : (
                  <div className="photo-fallback" aria-hidden="true">
                    {album.title.charAt(0).toUpperCase()}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {/* ---------- FEATURED MOMENT ---------- */}
      <section className="gal-featured section-frame" aria-labelledby="featured-title">
        <div className="section-rule" />
        <div className="eyebrow"><span className="dot-green" /> FEATURED MOMENT</div>
        <h2 id="featured-title">One community.<br />Countless moments.</h2>

        {featuredLoading ? (
          <div className="featured-skeleton" aria-hidden="true" />
        ) : null}

        {!featuredLoading && featuredError ? (
          <div className="gal-error" role="alert">
            <p>{friendlyFeedError(featuredError)}</p>
            <button type="button" onClick={featuredRetry}>Retry</button>
          </div>
        ) : null}

        {featuredEmpty ? (
          <div className="gal-empty" role="status">
            <strong>No featured moments yet.</strong>
            <span>Highlights will appear here once albums are featured.</span>
          </div>
        ) : null}

        {featuredPhoto ? (
          <figure className="featured-card">
            {featuredPhoto.url ? (
              <img src={featuredPhoto.url} alt={featuredPhoto.alt} loading="lazy" onError={hideImage} />
            ) : (
              <div className="photo-fallback" aria-hidden="true">No image</div>
            )}
            {featuredPhoto.caption ? <figcaption>{featuredPhoto.caption}</figcaption> : null}
          </figure>
        ) : null}
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="gal-final section-frame" aria-labelledby="final-title">
        <div className="section-rule" />
        <div className="final-card">
          <div className="final-dots" aria-hidden="true">
            <span className="dot-red" />
            <span className="dot-blue" />
            <span className="dot-green" />
            <span className="dot-yellow" />
          </div>
          <h2 id="final-title">Were you there?</h2>
          <p className="sub">Find yourself, tag your teammates, and relive the moments.</p>
          <Link to="/contact" className="green-pill">
            Follow our community <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
