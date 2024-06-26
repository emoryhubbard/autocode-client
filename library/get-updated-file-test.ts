import { getUpdatedFile } from "./get-updated-file";

const existingFile1 = `'use client'
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
            placeholder={\`<div class="my-container">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
          />
          <label htmlFor="cssCode" className="block font-semibold mb-2">
            Paste CSS Code:
          </label>
          <textarea
            name="csscode"
            rows={6}
            className="border border-solid border-[#4a4a4a] w-full text-[#4a4a4a] bg-[#f1f1f1] shadow-none box-border mb-[10px] px-[10px] py-[6px] rounded-[4px] border-[#f1f1f1]"
            defaultValue={""}
            placeholder={\`.my-container { \n\tbackground-color: #f0f0f0; padding: 20px;\n }\`}
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
          placeholder={\`<div class="my-container bg-[#f0f0f0] p-4">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
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
}`;

const existingFile4_5 = `import { useState, useEffect } from 'react';
import { setLocalStorage } from '../components/utils.mjs';

export default function Home() {
  const [lastVisit, setLastVisit] = useState(null);

  useEffect(() => {
    setLastVisit(new Date().getTime());
    setLocalStorage('lastVisit', lastVisit);
    console.log('Last visit set to:', lastVisit);
  }, []);

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
                placeholder={\`<div class="my-container">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
              />
              <label htmlFor="cssCode" className="block font-semibold mb-2">
                Paste CSS Code:
              </label>
              <textarea
                name="csscode"
                rows={6}
                className="border border-solid border-[#4a4a4a] w-full text-[#4a4a4a] bg-[#f1f1f1] shadow-none box-border mb-[10px] px-[10px] py-[6px] rounded-[4px] border-[#f1f1f1]"
                defaultValue={""}
                placeholder={\`.my-container { \n\tbackground-color: #f0f0f0; padding: 20px;\n }\`}
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
              placeholder={\`<div class="my-container bg-[#f0f0f0] p-4">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
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
    }`;

const existingFile7 = `'use client'
import Script from 'next/script';
import Header from './components/header';
import Footer from './components/footer';
import useState from 'react';
import useEffect from 'react';
import setLocalStorage from '../components/utils.mjs';
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
  const setLastVisit = () => {
    setLocalStorage('lastVisit', new Date().getTime());
    console.log('Last visit set to:', new Date().getTime());
  };
  useEffect(() => {
    setLastVisit();
  }, []);
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
            placeholder={\`<div class="my-container">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
          />
          <label htmlFor="cssCode" className="block font-semibold mb-2">
            Paste CSS Code:
          </label>
          <textarea
            name="csscode"
            rows={6}
            className="border border-solid border-[#4a4a4a] w-full text-[#4a4a4a] bg-[#f1f1f1] shadow-none box-border mb-[10px] px-[10px] py-[6px] rounded-[4px] border-[#f1f1f1]"
            defaultValue={""}
            placeholder={\`.my-container { \n\tbackground-color: #f0f0f0; padding: 20px;\n }\`}
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
          placeholder={\`<div class="my-container bg-[#f0f0f0] p-4">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
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
}`;

const existingFile8 = `'use client'
import Script from 'next/script';
import Header from './components/header';
import Footer from './components/footer';
import { useState } from 'react';
import { useEffect } from 'react';
import { setLocalStorage } from './components/utils.mjs';
export default function Home() {
    const setLastVisit = () => {
        setLocalStorage('lastVisit', new Date());
        console.log('Last visit set to: ' + new Date());
    }

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
          placeholder={\`<div class="my-container">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
        />
        <label htmlFor="cssCode" className="block font-semibold mb-2">
          Paste CSS Code:
        </label>
        <textarea
          name="csscode"
          rows={6}
          className="border border-solid border-[#4a4a4a] w-full text-[#4a4a4a] bg-[#f1f1f1] shadow-none box-border mb-[10px] px-[10px] py-[6px] rounded-[4px] border-[#f1f1f1]"
          defaultValue={""}
          placeholder={\`.my-container { \n\tbackground-color: #f0f0f0; padding: 20px;\n }\`}
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
        placeholder={\`<div class="my-container bg-[#f0f0f0] p-4">\n\tA problem well-stated is a problem half-solved.\n</div>\`}
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
}`

const snippet1 = `import { useState, useEffect } from 'react';
import { setLocalStorage } from '../utils.mjs';

export default function Home() {
  // ...

  const setLastVisit = () => {
    setLocalStorage('lastVisit', new Date().getTime());
  };

  useEffect(() => {
    setLastVisit();
    console.log('Last visit set to:', getLocalStorage('lastVisit'));
  }, []);

  // ...
}`;

const snippet2 = `import { useState, useEffect } from 'react';
import { setLocalStorage } from '../components/utils.mjs';

export default function Home() {
  const [allValues, setAllValues] = useState({ name: null, email: null, saves: 3 });

  const setLastVisit = () => {
    const currentTime = new Date().getTime();
    setLocalStorage('lastVisit', currentTime);
    console.log('Last visit set to:', currentTime);
  };

  useEffect(() => {
    setLastVisit();
    // ... rest of the code
  }, []);

  // ... rest of the code
}`;

const snippet3 = `import { useState, useEffect } from 'react'
import { setLocalStorage } from '../components/utils.mjs'

export default function Home() {
  // ...

  const setLastVisit = () => {
    setLocalStorage('lastVisit', new Date().getTime());
    console.log('Last visit set to', new Date().getTime());
  }

  useEffect(() => {
    setLastVisit();
  }, [])

  // ...
}`;

const snippet4 = `'use client';

import { useState, useEffect } from 'react';
import { setLocalStorage } from '../components/utils.mjs';

export default function Home() {
  const [lastVisit, setLastVisit] = useState(null);

  useEffect(() => {
    setLastVisit(new Date().getTime());
    setLocalStorage('lastVisit', lastVisit);
    console.log('Last visit set to:', lastVisit);
  }, []);

  // ... rest of the code remains the same ...
}`;

const snippet5 = `import { useState, useEffect } from 'react';
import { setLocalStorage } from '../components/utils.mjs';

export default function Home() {
  const [lastVisit, setLastVisit] = useState(null);

  useEffect(() => {
    setLastVisit(new Date().getTime());
    setLocalStorage('lastVisit', lastVisit);
    console.log('Last visit set to:', lastVisit);
  }, []);

  // ... rest of the code remains the same`;

const snippet7 = `import { useState, useEffect } from 'react';
import { setLocalStorage } from './components/utils.mjs'; // corrected import path

export default function Home() {
  const setLastVisit = () => {
    setLocalStorage('lastVisit', new Date().getTime());
    console.log('Last visit set to:', new Date().getTime());
  };

  useEffect(() => {
    setLastVisit();
  }, []);

  // ...
}`;

const snippet8 = `import { setLocalStorage } from './components/utils.mjs';

export default function Home() {
    const setLastVisit = () => {
        setLocalStorage('lastVisit', new Date());
        console.log('Last visit set to: ' + new Date());
    }

    setLastVisit(); // Call the setLastVisit function to ensure it runs

    // Rest of the component code

    return (
        <>
            {/* Rest of the JSX code */}
        </>
    )
}`;

const snippet9 = `import { setLocalStorage } from './utils.mjs';

export default function Home() {
    const [allValues, setAllValues] =  useState({name: null, email: null, saves: 3});

    const setLastVisit = () => {
        setLocalStorage('lastVisit', new Date());
        console.log('Last visit time set to: ' + new Date());
    }

    useEffect( () => {
       fetch('/api/session')
        .then((response) => response.json())
        .then((data) => {
            const { name, email, saves } = data.session;
            setAllValues({name: name, email: email, saves: saves});
        });

        setLastVisit();
    }, []);

    return (
        <>
        {/* Rest of the component code */}
        </>
    )
}`;

function printSnippetUpdated(existingFile: string, snippet: string, updated: string) {
    console.log("Snippet: ");
    console.log(snippet);
    console.log("UpdatedFile: ");
    console.log(updated);
}
function printExistSnippetUpdated(existingFile: string, snippet: string, updated: string) {
    console.log("Snippet: ");
    console.log(snippet);
    console.log("ExistingFile: ");
    console.log(existingFile);
    console.log("UpdatedFile: ");
    console.log(updated);
}
const tests = [
    [existingFile1, snippet1, "Test 1"],
    [existingFile1, snippet2, "Test 2"],
    [existingFile1, snippet3, "Test 3"],
    [existingFile1, snippet4, "Test 4"],
    [existingFile1, snippet5, "Test 5"],
    [existingFile4_5, snippet4, "Test 4.5", "true"],
    [existingFile7, snippet7, "Test 7", "true"],
    [existingFile8, snippet8, "Test 8", "true"],
    [existingFile1, snippet9, "Test 9"],
]

export async function getUpdatedFileTest() {
    fullTest();
    //oneTest(existingFile1, snippet9);
}
async function oneTest(existingFile: string, snippet: string) {
    await getUpdatedFile(existingFile, snippet, "src/app/page.jsx");
    console.log("Snippet: " + snippet);
    console.log("ExistingFile: " + existingFile);
}
async function fullTest() {
    let updatedFiles = []
    for (const test of tests) {
        updatedFiles.push(await getUpdatedFile(test[0], test[1], "src/app/page.jsx"))
    }

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        console.log(test[2] + ": ");
        if (test[3])
            printExistSnippetUpdated(test[0], test[1], updatedFiles[i]);
        if (!test[3])
            printSnippetUpdated(test[0], test[1], updatedFiles[i]);
    }
}
