// 假设您有控制 Participant、Message 和 Meeting Minutes 展开/收起的按钮

const leftSection = document.querySelector('.left-section');
const rightSection = document.querySelector('.right-section');
const centerSection = document.querySelector('.center-section');

// Participant 和 Message 的展开/收起逻辑
function toggleLeftSection() {
  leftSection.classList.toggle('collapsed');
}

// Meeting Minutes 的展开/收起逻辑
function toggleRightSection() {
  rightSection.classList.toggle('collapsed');
  centerSection.classList.toggle('right-expanded');
}

// 将这些函数绑定到相应的按钮上
document.querySelector('#toggle-left-btn').addEventListener('click', toggleLeftSection);
document.querySelector('#toggle-right-btn').addEventListener('click', toggleRightSection);
