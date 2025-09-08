"use client"
import { useState } from "react"
export default function LogInField () {
    const [newCode, setNewCode] = useState("")
    const [NewPass, setNewPass] = useState("")
    function userFilled() {
        console.log("this is your email: " + newCode + " this is your password: " + NewPass )
    
      }
    const codeHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewCode(e.target.value)
    }
    const passHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewPass(e.target.value)
    }
    return(

    <form id="create-form">
    <label htmlFor="code">buisness code:</label>
    <input type="text" placeholder="Code" name="code"id="Code-field" className="input-field" onChange={codeHandler}/>
    <label htmlFor="password">password:</label>
    <input type="text" placeholder="Password" name="password" id="pass-field" className="input-field" onChange={passHandler}/>
    <button id="submit-btn" onClick={userFilled}>Submit</button>
    </form>
    )
}