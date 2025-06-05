import axios from 'axios';
import React, { useEffect } from 'react'
import { useState } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';

const States = {
    "INPUT": "input",
    "OUTPUT": "output"
}

const CodeRun = ({ codeRef, socketRef, roomId }) => {
    const [currentState, setCurrentState] = useState(States.INPUT);
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [language, setLanguage] = useState("5");

    // Socket event listeners for synchronization
    useEffect(() => {
        if (socketRef.current) {
            const handleInputChange = ({ input }) => {
                setInput(input);
            };

            const handleOutputChange = ({ output }) => {
                setOutput(output);
                setCurrentState(States.OUTPUT);
            };

            const handleLanguageChange = ({ language }) => {
                setLanguage(language);
            };

            const handleStateChange = ({ currentState }) => {
                setCurrentState(currentState);
            };

            const handleCodeRun = () => {
                toast.success("Another user is running the code...");
            };

            socketRef.current.on(ACTIONS.INPUT_CHANGE, handleInputChange);
            socketRef.current.on(ACTIONS.OUTPUT_CHANGE, handleOutputChange);
            socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
            socketRef.current.on(ACTIONS.STATE_CHANGE, handleStateChange);
            socketRef.current.on(ACTIONS.CODE_RUN, handleCodeRun);

            return () => {
                if (socketRef.current) {
                    socketRef.current.off(ACTIONS.INPUT_CHANGE, handleInputChange);
                    socketRef.current.off(ACTIONS.OUTPUT_CHANGE, handleOutputChange);
                    socketRef.current.off(ACTIONS.LANGUAGE_CHANGE, handleLanguageChange);
                    socketRef.current.off(ACTIONS.STATE_CHANGE, handleStateChange);
                    socketRef.current.off(ACTIONS.CODE_RUN, handleCodeRun);
                }
            };
        }
    }, [socketRef.current]);

    const handleInputChange = (newInput) => {
        setInput(newInput);
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit(ACTIONS.INPUT_CHANGE, {
                roomId,
                input: newInput
            });
        }
    };

    const handleLanguageChange = (newLanguage) => {
        setLanguage(newLanguage);
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
                roomId,
                language: newLanguage
            });
        }
    };

    const handleStateChange = (newState) => {
        setCurrentState(newState);
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit(ACTIONS.STATE_CHANGE, {
                roomId,
                currentState: newState
            });
        }
    };
    
    const runCode = () => {
        toast.success("Running Code");
        
        // Notify other users that code is being run
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit(ACTIONS.CODE_RUN, { roomId });
        }

        var options = {
          method: "POST",
          url: "https://code-compiler.p.rapidapi.com/v2",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "x-rapidapi-host": "code-compiler.p.rapidapi.com",
            "x-rapidapi-key":
              "0ca192bd34mshca25146e7ea1142p17a87ajsn20830dca802b",
          },
          data: {
            LanguageChoice: language,
            Program: codeRef.current,
            Input: input
          },
        };

        axios
          .request(options)
          .then(function (response) {
              const resultOutput = response.data.Errors || response.data.Result || "No output";
              setOutput(resultOutput);
              setCurrentState(States.OUTPUT);
              
              // Sync output to other users
              if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit(ACTIONS.OUTPUT_CHANGE, {
                      roomId,
                      output: resultOutput
                  });
              }

              if (response.data.Errors) {
                  toast.error("Code failed !");
              } else {
                  toast.success("Code executed successfully !");
              }
          })
          .catch(function (error) {
              console.error(error);
              const errorOutput = error.toString();
              setOutput(errorOutput);
              setCurrentState(States.OUTPUT);
              
              // Sync error output to other users
              if (socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit(ACTIONS.OUTPUT_CHANGE, {
                      roomId,
                      output: errorOutput
                  });
              }
              
              toast.error("Code failed !");
          });
    }

  return (
    <div className="inputOutputWrap">
      <div className="btnWrap">
        <div>
          <button
            style={{ opacity: currentState === States.INPUT ? "1" : "0.8" }}
            onClick={() => handleStateChange(States.INPUT)}
          >
            Input
          </button>
          <button
            style={{ opacity: currentState === States.OUTPUT ? "1" : "0.8" }}
            onClick={() => handleStateChange(States.OUTPUT)}
          >
            Output
          </button>
        </div>
        <div>
            <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
                <option value="5" >Python</option>
                <option value="7" >C++</option>
                <option value="4" >Java</option>
                <option value="17" >JavaScript</option>
            </select>
          <button onClick={runCode} >Run</button>
        </div>
      </div>
      <textarea
        name=""
        id=""
        cols="30"
        rows="10"
        placeholder="Enter your input here..."
        readOnly={currentState === States.OUTPUT}
        value={currentState === States.INPUT ? input : output}
        onChange={(e) => handleInputChange(e.target.value)}
      ></textarea>
    </div>
  );
}

export default CodeRun;