'use client'
import Script from 'next/script'
import Header from './components/header'
import Footer from './components/footer'
import {useState, useEffect} from 'react'

export default function Home() {
    const [allValues, setAllValues] =  useState({name: null, email: null, saves: 3})
    useEffect( () => {
       fetch('/api/session')
        .then((response) => response.json())
        .then((data) => {
            const { name, email, saves } = data.session
            setAllValues({name: name, email: email, saves: saves})
        })
        }, [])
    return (
        <>
        <title>Tailwindify Home Page</title>
        <Header />
        <div className='has-has-main'>
        <div className='has-main'>
        <main className='text-[1.35rem] leading-[1.618] max-w-[38em] text-[#4a4a4a] bg-[#f9f9f9] m-auto p-[13px] sm:text-[1.53rem] md:text-[1.8rem] lg:text-[1.8rem]'>
    <section>
      <h1 className='leading-[1.1] font-bold break-words mt-12 mb-6 text-[2.35em]'>
        Transform Your Styles
      </h1>
      <p className="mt-0 mb-10">
        Convert your CSS to Tailwind CSS seamlessly. Paste your HTML
        and CSS code to generate Tailwind-styled HTML output.
      </p>
      {/* File Upload Section */}
      <form className='convert-css-form'>
        <fieldset className="block font-semibold mb-2">
          <label htmlFor="htmlCode" className="block font-semibold mb-2">
            Paste HTML Code:
          </label>
          <textarea
            name="htmlcode"
            rows={6}
            className="border border-solid border-[#4a4a4a] w-full text-[#4a4a4a] bg-[#f1f1f1] shadow-none box-border mb-8 px-[10px] py-[6px] rounded-[4px] border-[#f1f1f1]"
            defaultValue={""}
            placeholder={`<div class="my-container">\n\tA problem well-stated is a problem half-solved.\n</div>`}
          />
          <label htmlFor="cssCode" className="block font-semibold mb-2">
            Paste CSS Code:
          </label>
          <textarea
            name="csscode"
            rows={6}
            className="border border-solid border-[#4a4a4a] w-full text-[#4a4a4a] bg-[#f1f1f1] shadow-none box-border mb-[10px] px-[10px] py-[6px] rounded-[4px] border-[#f1f1f1]"
            defaultValue={""}
            placeholder={`.my-container { \n\tbackground-color: #f0f0f0; padding: 20px;\n }`}
          />
        </fieldset>
        {/* CTA Button */}
        <button
          type="submit"
          className="convert-button inline-block text-center no-underline whitespace-nowrap bg-[#1d7484] text-[#f9f9f9] border cursor-pointer box-border px-[10px] py-[5px] rounded-[1px] border-solid border-[#1d7484] bg-[#982c61] text-[#f9f9f9]"
        >
          Convert Now
        </button> <span>{'\u00A0\u00A0\u00A0(' + (allValues.name ? 'Unlimited': allValues.saves)} free saves left{')'}</span>
      </form>
      {/* HTML Output Section */}
      <div>
        <h2 className='leading-[1.1] font-bold break-words mt-12 mb-6 text-[2em]'>
          Output HTML with Tailwind CSS
        </h2>
        <textarea
          rows={6}
          className="output-html border border-solid border-[#4a4a4a] w-full text-[#4a4a4a] bg-[#f1f1f1] shadow-none box-border mb-[10px] px-[10px] py-[6px] rounded-[4px] border-[#f1f1f1]"
          defaultValue={""}
          placeholder={`<div class="my-container bg-[#f0f0f0] p-4">\n\tA problem well-stated is a problem half-solved.\n</div>`}
        />
      </div>
      
    {/* Additional Explanation */}
    <p className="mt-0 mb-10">
        If you need to convert your HTML to JSX for React, you can use{" "}
        <a
        href="https://transform.tools/html-to-jsx"
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline text-[#1d7484] visited:text-[#144f5a] hover:text-[#982c61] hover:border-b-2 hover:border-b-[#4a4a4a] hover:border-solid"
        >
        https://transform.tools/html-to-jsx
        </a>
        .
    </p>
    </section>
  </main>
  </div>
  </div>
        <Footer />
        <Script type='module' src="/js/home.js" />
        </>
    )
}