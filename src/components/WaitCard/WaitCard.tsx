import React from 'react';
import "./wait.css"
export default function WaitCard() {
    function mailMe(event: React.MouseEvent<HTMLSpanElement>) {
        event.preventDefault();
        
        const mailLink = document.createElement("a");
        mailLink.href = "mailto:kontakt.nordev@gmail.com";
        mailLink.click();
    }

    return (
        <div className='trans-p-bg'>
            <div id='WaitCreate'>
                <h1>Wait!</h1>
                <p>We are getting to you soon :)</p>
                <p>Need help faster?<span onClick={mailMe} id='clickable-link'> Mail us</span></p>
                
            </div>
        </div>
    );
}