import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDate, mapAlbum, mapGalleryCategory, mapPhoto, publicApi, usePublicFeed } from '../api/public.js';
import { friendlyFeedError, hideImage } from '../components/FeedStates.jsx';
import '../styles/gallery.css';

/** Fallback button styles cycled for admin-added categories beyond the seeded three. */
const CATEGORY_BTN_CLASSES = ['btn-events', 'btn-workshops', 'btn-community', 'btn-all'];

function categoryBtnClass(slug, index) {
  const known = { events: 'btn-events', workshops: 'btn-workshops', community: 'btn-community' };
  if (slug && known[slug]) return known[slug];
  return CATEGORY_BTN_CLASSES[index % CATEGORY_BTN_CLASSES.length];
}

function AlbumDetail({ slug }) {  const { data, loading, error, retry } = usePublicFeed(
    () => publicApi.getAlbumBySlug(slug).then((a) => (a ? mapAlbum(a) : null)),
    `album-${slug}`,
  );

  return (
    <div className="page-gallery">
      <div className="album-detail">
        <div className="album-detail-head">
          <Link to="/gallery" className="gdg-btn gdg-btn-secondary">← All albums</Link>
          {loading ? (
            <div className="gallery-state" role="status" aria-label="Loading album">
              <div className="box is-skeleton" aria-hidden="true">
                <div className="box-skeleton-media" />
                <div className="box-skeleton-lines">
                  <div className="gal-skeleton-line" />
                  <div className="gal-skeleton-line short" />
                </div>
              </div>
              <span className="gdg-visually-hidden">Loading album…</span>
            </div>
          ) : null}
          {!loading && (error || !data) ? (
            <div className="gallery-state">
              <div className="gal-error" role="alert">
                <p>{error ? friendlyFeedError(error) : 'This album is not published.'}</p>
                <button type="button" onClick={retry}>Retry</button>
              </div>
            </div>
          ) : null}
          {!loading && !error && data ? (
            <>
              <h2>{data.title}</h2>
              {data.description ? <p className="gdg-desc">{data.description}</p> : null}
              <div className="album-detail-meta">
                {data.categoryName ? <span>{data.categoryName}</span> : null}
                {data.date ? <span>{formatDate(data.date)}</span> : null}
                <span>{data.items.length} Photos</span>
              </div>
            </>
          ) : null}
        </div>

        {!loading && !error && data?.items?.length ? (
          <div className="album-grid">
            {data.items.map((photo) => (
              <div key={photo.id} className="album-photo-card gdg-card">
                {photo.url ? (
                  <img src={photo.url} alt={photo.alt} loading="lazy" onError={hideImage} />
                ) : (
                  <div className="card-featured-fallback" aria-hidden="true">No image</div>
                )}
                {photo.caption ? <p>{photo.caption}</p> : null}
              </div>
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

  const carouselRef = useRef(null);
  const wrapperRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const pos = el.scrollLeft;
    setShowLeft(pos > 5);
    setShowRight(pos < maxScroll - 5);
  }, []);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades);
    return () => {
      el.removeEventListener('scroll', updateFades);
      window.removeEventListener('resize', updateFades);
    };
  }, [updateFades, featuredData, featuredLoading]);

  useEffect(() => {
    updateFades();
  }, [featuredData, updateFades]);

  const scrollLeft = useCallback(() => {
    carouselRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    carouselRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
  }, []);

  const featuredEmpty = !featuredLoading && !featuredError && (!featuredData || featuredData.length === 0);

  return (
    <div className="page-gallery">
      <div className="hero">
        <img className="doodle doodle-1" src="/layout-assets/gallery/Group 168.png" alt="" aria-hidden="true" />
        <img className="doodle doodle-2" src="/layout-assets/gallery/Group 170.png" alt="" aria-hidden="true" />
        <img className="doodle doodle-3" src="/layout-assets/gallery/Group 169.png" alt="" aria-hidden="true" />
        <img className="doodle doodle-4" src="/layout-assets/gallery/Group 171.png" alt="" aria-hidden="true" />

        <button className="gallery-btn" type="button" disabled>
          <span className="dot" aria-hidden="true" />
          GALLERY
        </button>

        <h1>See the community</h1>
        <h1>
          in <img src="/layout-assets/gallery/action logo.png" className="action-img" alt="in action" />
        </h1>

        <p>Workshops, events, late-night builds, new connections, and the</p>
        <p>moments in between.</p>

        <a href="#captured-moments" className="cta-btn">
          View the gallery
          <div aria-hidden="true">
            <span className="arrow-down">↓</span>
          </div>
        </a>

        <hr id="captured-moments" />

        <h1 className="captured-title">Captured Moments</h1>

        <div className="captured-buttons" role="group" aria-label="Filter albums">
          <button
            type="button"
            className={`btn-all ${filter === 'all' ? 'is-active' : ''}`}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {categories.map((c, idx) => (
            <button
              key={c.slug ?? c.id}
              type="button"
              className={`${categoryBtnClass(c.slug, idx)} ${filter === c.slug ? 'is-active' : ''}`}
              aria-pressed={filter === c.slug}
              onClick={() => setFilter(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="box-row">
          {albumsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="box is-skeleton" aria-hidden="true">
                <div className="box-skeleton-media" />
                <div className="box-skeleton-lines">
                  <div className="gal-skeleton-line" />
                  <div className="gal-skeleton-line short" />
                  <div className="gal-skeleton-line tiny" />
                </div>
              </div>
            ))
          ) : null}

          {!albumsLoading && albumsError ? (
            <div className="gallery-state">
              <div className="gal-error" role="alert">
                <p>{friendlyFeedError(albumsError)}</p>
                <button type="button" onClick={albumsRetry}>Retry</button>
              </div>
            </div>
          ) : null}

          {albumsEmpty ? (
            <div className="gallery-state">
              <div className="gal-empty">
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
            </div>
          ) : null}

          {!albumsLoading && !albumsError && (albumsData ?? []).length > 0 ? (
            (albumsData ?? []).map((album) => (
              <Link
                key={album.id}
                to={album.slug ? `/gallery/${album.slug}` : '/gallery'}
                className="box"
                aria-label={`Open album ${album.title}`}
              >
                <div className="box-media">
                  {album.coverUrl ? (
                    <img src={album.coverUrl} alt={album.coverAlt} loading="lazy" onError={hideImage} />
                  ) : (
                    <div className="box-fallback" aria-hidden="true">
                      {album.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="box-body">
                  <h3>{album.title}</h3>
                  {album.description ? <p>{album.description}</p> : null}
                  <div className="box-meta">
                    {album.categoryName ? <span>{album.categoryName}</span> : null}
                    {album.date ? <span>{formatDate(album.date)}</span> : null}
                    <span>{album.photoCount} Photos</span>
                  </div>
                </div>
              </Link>
            ))
          ) : null}
        </div>

        <hr />

        <button className="featured-moment-btn" type="button" disabled>
          <span className="feat-dot" aria-hidden="true" />
          FEATURED MOMENT
        </button>

        <h1>One community.</h1>
        <h1>Countless moments.</h1>

        <div
          ref={wrapperRef}
          className={`carousel-wrapper ${showLeft ? 'show-left' : ''} ${showRight ? 'show-right' : ''}`.trim()}
        >
          <button
            type="button"
            className="carousel-arrow carousel-arrow--left"
            aria-label="Scroll featured left"
            onClick={scrollLeft}
          >
            ‹
          </button>
          <button
            type="button"
            className="carousel-arrow carousel-arrow--right"
            aria-label="Scroll featured right"
            onClick={scrollRight}
          >
            ›
          </button>

          <div ref={carouselRef} className="carousel" id="carousel">
            {featuredLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-featured is-skeleton" aria-hidden="true" />
              ))
            ) : null}

            {!featuredLoading && featuredError ? (
              <div className="carousel-state">
                <div className="gal-error" role="alert">
                  <p>{friendlyFeedError(featuredError)}</p>
                  <button type="button" onClick={featuredRetry}>Retry</button>
                </div>
              </div>
            ) : null}

            {featuredEmpty ? (
              <div className="carousel-state">
                <div className="gal-empty">
                  <strong>No featured moments yet.</strong>
                  <span>Highlights will appear here once albums are featured.</span>
                </div>
              </div>
            ) : null}

            {!featuredLoading && !featuredError && featuredData?.length ? (
              featuredData.map((photo) => (
                <div key={photo.id} className="card-featured">
                  {photo.url ? (
                    <img src={photo.url} alt={photo.alt} loading="lazy" onError={hideImage} />
                  ) : (
                    <div className="card-featured-fallback" aria-hidden="true">No image</div>
                  )}
                  {photo.caption ? <div className="card-caption">{photo.caption}</div> : null}
                </div>
              ))
            ) : null}
          </div>
        </div>

        <hr />

        <div className="box-event">
          <div className="dots" aria-hidden="true">
            <span className="dot dot-red" />
            <span className="dot dot-blue" />
            <span className="dot dot-green" />
            <span className="dot dot-yellow" />
          </div>
          <h2>Where you there?</h2>
          <p>Find yourself, tag your teammates, and relive the moments.</p>
          <Link to="/contact" className="register">
            Follow our community <span className="arrow-diagonal" aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
