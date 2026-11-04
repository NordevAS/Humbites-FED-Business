'use client';
import Link from '@/components/AppLink';
import { formatNok, type FoodTruck } from '@/domain';
import { useDemo } from '@/components/DemoProvider';
import { Icon } from '@/components/Icon';

export function TruckCard({ truck }: { truck: FoodTruck }) {
  const { favorites, toggleFavorite } = useDemo();
  const saved = favorites.includes(truck.id);
  const price = truck.menu.length
    ? Math.min(...truck.menu.map((item) => item.priceMinor))
    : null;
  return (
    <article className="truck-card pulse-card">
      <div className="pulse-card-meta">
        <span>{truck.cuisine}</span>
        <span>
          <Icon name="pin" size={14} />
          {truck.city}
        </span>
      </div>
      <div className="card-photo">
        <Link
          href={`/foodtruck/${truck.slug}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={truck.image}
            alt=""
            loading="lazy"
            width="640"
            height="520"
          />
        </Link>
        <button
          className={`heart-button ${saved ? 'saved' : ''}`}
          onClick={() => toggleFavorite(truck.id)}
          aria-pressed={saved}
          aria-label={`${saved ? 'Fjern' : 'Lagre'} ${truck.name} ${saved ? 'fra' : 'som'} favoritt`}
        >
          <Icon name="heart" size={21} />
        </button>
      </div>
      <div className="card-body">
        <h3>
          <Link href={`/foodtruck/${truck.slug}`}>{truck.name}</Link>
        </h3>
        <p>{truck.shortDescription}</p>
        <div className="card-tags">
          {truck.tags.slice(0, 2).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="card-price">
          <div>
            <span className="pulse-price-label">Leiepris</span>{' '}
            <strong>
              {truck.fixedFeeMinor === null
                ? 'Avklar med eier'
                : formatNok(truck.fixedFeeMinor)}
            </strong>
            <span> inkl. transport og rigg</span>
            <small>
              {price === null
                ? 'Meny kommer'
                : `Gjesten betaler mat fra ${formatNok(price)} per porsjon`}
            </small>
          </div>
          <Link
            href={`/foodtruck/${truck.slug}`}
            className="card-arrow"
            aria-label={`Se menyen til ${truck.name}`}
          >
            <Icon name="arrow" size={24} />
          </Link>
        </div>
        <Link className="pulse-menu-link" href={`/foodtruck/${truck.slug}`}>
          Se meny og truck <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
