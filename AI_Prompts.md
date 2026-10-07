# Section 1

1. Create a file called AI_Prompts.md. Use this to log all the prompts I give. Start by creating Section 1 and also log this prompt in it.

# Section 2

2. Create section 2
3. Create a folder called outout. In that create a file called harness.md
4. I want to understand [campus_customs.db](data/campus_customs.db)

5. In [harness.md](outout/harness.md) , add a section called Database. In the section write that the database has 4 tables - Users, catalogue, inventory and chat messages. The Catalogue represents the products, their descriptions and prices along with other data. The Users contains the accounts of the websites users. However, never share or print the password hashes. Inventory is the quantity of items accounting for both in-stock and out-of-stock items. Lastly, chat_messages contains log of previous user chats and some might even contain product details.

# Section 3

6. Scaffold a React+Vite+Typescript front end for Campus Customs. Put a navigation panel at top that links to the following pages - Home, Products, About Us, Log in, Create account.
7. Run the app
8. I want the main theme to be blue. specifically the shade of blue that is associated with Yale.
9. On the products page show product images in [campus_customs.db](data/campus_customs.db) . When clicked on a product image, open a new page which is specifically about that item. Have a large image on one side, full product name on the right and then in subsequent lines under the name add the description, price, sizes in stcok or out of stock. So basically clicking on the image takes the user to that products shopping page
10. Create a floating chat panel in the bottol right. It might be useless right now but let it be like a stub which will call my backend later

# Section 4

11. Create section 4
12. Now add a log-in feature. When the user presses log-in, there should be an option to signup if the user doesn't have an account. What I would want when creating account is to ask for user's first name, last name, email and password with a confirm password functionality. What I want you to make sure is that the passwords are stored securely. New accounts go into the users table of [campus_customs.db](data/campus_customs.db)
13. The seed database has email: test@campuscustoms.yale.edu with password: [REDACTED]. I am not able to log in using those details.
14. Please create a new section in [harness.md](outout/harness.md) called Account and Login. Describe what all is stored for a user and how are passwords protected

# Section 5

15. Create section 5
16. create a PydanticAI agent behind FastAPI, plugged into your front-end chat widget. Put the API app in a python script called main.py which will be in a folder called backend. That is the file what will run with Uvicorn. Keep the agent as the four files next to it: 1. backend/prompts/prompt.md which will be the system prompt and will grow later. 2. backend/agent.py which is basically the agent entry / wiring. backend/tools.py which is a tool the agent can call and finally backend/models.py which has the Pydantic/PydanticAI structured types. In main.py expose a chat route so a message from the website returns a reply from the agent and whatever is required for product/authentication. the AI model might need the API key and use my PortkeyAPI key but make sure it is never hardcoded anywhere in the code and not exposed to the front end
17. Put Campus Customs voice and safety basics into prompts/prompt.md. Start or update types in models.py for chat replies / product cards as needed. In output/harness.md, note how the front end talks to FastAPI and how the agent is loaded (prompt file+model). Make sure backend runs from the backed/ folder.

# Section 6

18. Create section 6
19. Give agent tools that up real information from [campus_customs.db](data/campus_customs.db) : Product description, price, How many are in stock and by what size if customer asks. The agent must and only must use the data base. never invent prices or quantitities. If a size is out of stock, say so clearly.
20. Expand [prompt.md](backend/prompts/prompt.md) so the agent knows to call these tools for price and stock questions. Add or update return types in models.py. In [harness.md](outout/harness.md), list each tool and explain which model fields you chose for lookup and results and why.

# Section 7

21. Create section 7
22. Now, when a customer asks about a type of item, such as what hoodies do you have? the agent should search the catalogue and the website should dynamically show these matching items as product cards (image, name, price, short info). This is an API contract: the agent returns structured product matches and then the front end renders them on the website.
23. After the dynamic product cards are loaded, make sure the same single-item page behaviour built in section 3 still works. That is, each product card-including the ones the chat just put on the page-should still open that detail view (large image+full info) when clicked. Update [prompt.md](backend/prompts/prompt.md) and [harness.md](outout/harness.md) so it is clear how the search results are reaching the page.

# Section 8

24. Create section 8
25. When a shopper is logged in, save their chat history in a database in an appropriate table and reload it when they return. The agent should know who is chatting (name,email) - put that in agent deps (or an equivalent clear pattern) and/or tools the agent can call. Also pass enough page context that if someone is on a product page and asks "do you have this in pink", the agent knows which items they mean. Hint: you can put code into the agent context. Guests can still chat, but history only needs to persist for logged-in users. Document in [harness.md](outout/harness.md) how user chat history is stored, what customer fields and agent sees and how page context is passed.

# Section 9

26. Create section 9
27. In the front end: add these two features - Search, filter and sort by category, price and customization options and a cart and checkout clarity. In the backend, add a batching method for catalog lookups to make the agent faster and cheaper and retries and fallbacks with clear error messages when a tool fails. Write output/usability.md before or as you build which mentions why the feature was added and how it helps a shopper or the business.

# Section 10

28. Create section 10
29. Add creative design so the site feels like a real Campus Customs storefront - fonts, color, hierarchy, motion, product presentation, chat feel. For example, use handsome dan icons and stuff. write output/design.md which has the changes and how they help the customer retention
30. this is not handsome dan. use this photo
31. I cant see the mascot. Its only HD writtem.
32. dont make additional folder which is not asked. Download images and cartoons from internet

# Section 11

33. create section 11
34. Test the live site and document it in output/app_check.html. Include clear screenshots and short captions for 1. Chat checking the inventory level of an item (honest stock/price from the database) 2. The dynamic search results cards appearing after a category question (ed. hoodies). 3 One of the usability features added in section 8
35. Make the HTML easy to grade: heading for each check, screenshot, one or two sentences on what the screenshot proves. Put the screenshot image filers in output/app_check_images/ and link them from app_check.html with relative paths (for example app_check_images/inventory.png)

# Section 12

36. create section 12
37. Keep an append-only output/audit_trail.json of agent-loop activity (time, tool name, short args/result, stop eason). Do not wipe it between runs. add relevant instructions from [AGENTS.md](.venv/lib/python3.14/site-packages/pydantic_ai/AGENTS.md) and put them [prompt.md](backend/prompts/prompt.md). Finish output/harness.md so it is clear how the system works. Model fields in model.py and why they are relevant. Tools and abilities. Safety rules. Specs (loop limits, result caps, models, how to run front + back)

# Section 13

38. create section 13
39. follow the instructions as per the image - Put your code in a folder named hw4 and push it to a public GitHub repository. On Canvas, submit the repo URL. Do not put the real .env, campus_customs.db, or product images in the repository; use .gitignore and a placeholder .env.example. Use the shown frontend/, backend/, output/ layout, keep data/ as a local-only pack, and document how to run both services in README.md.
40. The # FastAPI.. line was cut from the photo. The complete line is #FastAPI app - run with: uvicorn main: app --reload -- port 8000
