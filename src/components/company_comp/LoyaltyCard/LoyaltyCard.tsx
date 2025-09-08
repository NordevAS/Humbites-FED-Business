import "./LoyaltyCard.css";

/**
 * @param {Object} props
 * @param {string} props.foodIcon 
 * @param {number} props.numberFood 
 */
export default function LoyaltyCard({ foodIcon, numberFood }: { foodIcon: string; numberFood: number }) {
    return (
        <div id="Card-bg-Loyal">
            {foodIcon !== "" ? (
                <>
                <h2 className="placeName">Place Name</h2>
                <h3 className="LoyaltyName">Loyalty Card</h3>
                    <div id="icon-holders">
                        {Array.from({ length: numberFood }).map((_, index) => (
                            <div key={index}>
                                <img src={`/foodIcons/${foodIcon}.svg`} alt={`Icon of ${foodIcon}`} />
                            </div>
                        ))}
                    </div>
                    <p>BUY {numberFood - 1} {foodIcon} GET {numberFood} FOR <span className="orangeTxt">FREE</span></p>
                </>
            ) : (
                <>
                   <h2 className="placeName">Place Name</h2>
                   <h3 className="LoyaltyName">Loyalty Card</h3>
                    <div id="icon-holders">
                        {Array.from({ length: numberFood }).map((_, index) => (
                            <div key={index} className="roundIcon">
                                {index == numberFood - 1? <p>FREE</p>: <p>{index + 1}</p>}
                            </div>
                        ))}
                    </div>
                    <p>BUY {numberFood - 1} GET {numberFood} FOR <span className="orangeTxt">FREE</span></p>
                </>
            )} 
        </div>
    );
}
