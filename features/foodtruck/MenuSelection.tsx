'use client';
import { useState } from 'react';
import './rental-menu.css';
import { formatNok, type FoodTruck } from '@/domain';
import { useDemo } from '@/components/DemoProvider';

/** Event customers select the menu to offer. Attendees buy their own portions on site. */
export function MenuSelection({ truck }: { truck: FoodTruck }) {
  const { event, quantities, setQuantity } = useDemo();
  const selection = quantities[truck.id] ?? {};
  const [error, setError] = useState('');
  const selectedCount = truck.menu.filter(
    (item) => selection[item.id] > 0,
  ).length;
  const categories = truck.menuCategories ?? [];
  const groups = [
    ...categories.map((category) => ({
      name: category.name,
      id: String(category.id),
      items: truck.menu.filter(
        (item) =>
          item.categoryIds?.find((id) =>
            categories.some((category) => category.id === id),
          ) === category.id,
      ),
    })),
    {
      name: categories.length ? 'Uten kategori' : 'Meny',
      id: 'uncategorized',
      items: truck.menu.filter(
        (item) =>
          !categories.some((category) =>
            item.categoryIds?.includes(category.id),
          ),
      ),
    },
  ].filter((group) => group.items.length);
  return (
    <section id="meny" className="menu-section" tabIndex={-1}>
      <div className="content-heading">
        <div>
          <span className="eyebrow">MENYEN PÅ ARRANGEMENTET</span>
          <h2>Hva skal trucken tilby?</h2>
        </div>
        <span className="menu-count">
          {event.guestCount} gjester · {selectedCount} retter valgt
        </span>
      </div>
      <p className="section-description">
        Du betaler for å leie foodtrucken, inkludert transport og rigg. Velg
        hvilke retter som skal tilbys. Gjestene bestiller og betaler maten sin
        selv på arrangementet.
      </p>
      {truck.booking?.maxGuests != null && (
        <p className="section-description">
          Trucken tar imot inntil {truck.booking.maxGuests} gjester.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {groups.map((group) => (
        <div key={group.id}>
          <h3>{group.name}</h3>
          <div className="menu-list">
            {group.items.map((item) => (
              <article
                className={`menu-item rental-menu-item ${selection[item.id] > 0 ? 'has-quantity' : ''}`}
                key={item.id}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    width="88"
                    height="88"
                    style={{ objectFit: 'cover', borderRadius: 12 }}
                  />
                )}
                <div className="menu-item-copy">
                  <div className="menu-name">
                    <h3>{item.name}</h3>
                    {item.dietaryTags.map((tag) => (
                      <span className="diet-tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p>{item.description}</p>
                  <small>
                    Allergener:{' '}
                    {item.allergens.length
                      ? item.allergens.join(', ')
                      : 'ikke oppgitt – avklar med eier'}
                  </small>
                  <strong>
                    {formatNok(item.priceMinor)}{' '}
                    <span>per porsjon · betales av gjesten</span>
                  </strong>
                </div>
                <label className="rental-menu-toggle">
                  <input
                    type="checkbox"
                    checked={selection[item.id] > 0}
                    onChange={(event) => {
                      setError(
                        setQuantity(
                          truck.id,
                          item.id,
                          event.target.checked ? 1 : 0,
                        )
                          ? ''
                          : 'Menyvalget kunne ikke oppdateres. Prøv igjen.',
                      );
                    }}
                  />
                  <span>
                    {selection[item.id] > 0
                      ? 'Valgt til menyen'
                      : 'Ta med på menyen'}
                  </span>
                  <span className="sr-only">: {item.name}</span>
                </label>
              </article>
            ))}
          </div>
        </div>
      ))}
      {!truck.menu.length && (
        <p>Trucken har ingen tilgjengelige retter akkurat nå.</p>
      )}
      <p className="menu-note">
        Rettpriser er informasjon til gjestene og legges ikke til leieprisen.
        Tilgjengelighet og spesielle behov avklares med eieren.
      </p>
    </section>
  );
}
