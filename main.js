const form = document.getElementById("form");
const day = document.getElementById("day");
const ol = document.getElementById("ol");
const btn = document.getElementById("btn");

// ポップアップで実行の最終確認の処理
function startFilling() {
  if(document.querySelectorAll(".li-wrapper").length == 0){
    window.alert("no item!");
    return false;
  } else if(!window.confirm("start autofilling?")) {
    return false;
  }
}

const addShift = () => {
  const wrapper = document.createElement("div");
  wrapper.setAttribute("class", "li-wrapper");
  ol.appendChild(wrapper);

  const li = document.createElement("li");
  li.textContent = `${day.value}${form.elements["shift"].value}`;
  wrapper.appendChild(li);

  const hidden = document.createElement("input");
  hidden.setAttribute("type", "hidden");
  hidden.setAttribute("name", "workdays[]");
  hidden.setAttribute("value", `${day.value}${form.elements["shift"].value}`);
  wrapper.appendChild(hidden);

  const dltbtn = document.createElement("button");
  dltbtn.innerText = "delete";
  wrapper.appendChild(dltbtn);
  dltbtn.addEventListener("click", () => {
    li.parentNode.remove();
    li.remove();
    hidden.remove();
    dltbtn.remove();
  });
};

btn.addEventListener("click", addShift);
