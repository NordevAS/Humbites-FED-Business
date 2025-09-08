"use client"
import { useState } from "react"
export default function CreateField () {
    const [newEmail, setNewEmail] = useState("")
    const [NewPass, setNewPass] = useState("")
    const [NewName, setNewName] = useState("")
    const [NewPhone, setNewPhone] = useState("")
  
    const nameHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewName(e.target.value)
    }
    const phoneHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewPhone(e.target.value)
    }
    const emailHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewEmail(e.target.value)
    }
    const passHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewPass(e.target.value)
    }
  
    function userFilled() {
      console.log("this is your email: " + newEmail + " this is your password: " + NewPass  + " this is the name: " + NewName + "this is the Phone: " + NewPhone)
  
    }
    return ( 


      <form id="create-form">

<section id="input-puts">
  <label htmlFor="CompanyName">company name:</label>
  <input type="text" placeholder="Company Name" id="Name-field" name="CompanyName" className="input-field" onChange={nameHandler}/>

  <label htmlFor="phone">phone number:</label>
  <input type="tel" name="phone" id="phone-field" className="input-field" onChange={phoneHandler} />

  <label htmlFor="email">buisness email:</label>
  <input type="email" placeholder="Email" name="email"id="Email-field" className="input-field" onChange={emailHandler}/>

  <label htmlFor="password">password:</label>
  <input type="text" placeholder="Password" name="password" id="pass-field" className="input-field" onChange={passHandler}/>
    </section>
          
          <button id="submit-btn" onClick={userFilled}>Submit</button>

    </form>
    )
}