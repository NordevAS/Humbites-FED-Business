import './MenuDisplay.css';

export default function MenuCreate(props: {banner: string, companyName: string, description: string}) {
 
    return (
        <div id='company-section'>
            <div>
                <img id='company-banner' src={props.banner}></img>
                <h1 id='company-header'>{props.companyName}</h1>
                <p id='company-description'>{props.description}</p>
            </div>
        </div>
    );
}